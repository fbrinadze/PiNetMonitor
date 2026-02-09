import { io } from 'socket.io-client';

/**
 * WebSocketService manages WebSocket connections to the backend server
 * Provides automatic reconnection, subscription management, and event handling
 */
class WebSocketService {
  constructor() {
    this.socket = null;
    this.url = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.eventHandlers = new Map(); // Map of event name to array of callbacks
    this.subscriptions = new Set(); // Track active subscriptions
    this.reconnectTimer = null;
    this.manualDisconnect = false;
  }

  /**
   * Connect to the WebSocket server
   * @param {string} url - WebSocket server URL (e.g., 'http://localhost:3000')
   */
  connect(url) {
    if (this.socket && this.isConnected) {
      console.warn('WebSocket already connected');
      return;
    }

    this.url = url;
    this.manualDisconnect = false;

    try {
      // Create socket connection with auto-reconnect disabled (we handle it manually)
      this.socket = io(url, {
        autoConnect: true,
        reconnection: false, // We handle reconnection manually for exponential backoff
        transports: ['websocket', 'polling']
      });

      // Set up connection event handlers
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        console.log('WebSocket connected');

        // Emit connection status event
        this._emitEvent('connection:status', { connected: true });

        // Re-subscribe to all previous subscriptions
        this._resubscribeAll();
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log('WebSocket disconnected:', reason);

        // Emit connection status event
        this._emitEvent('connection:status', { connected: false, reason });

        // Attempt reconnection if not manually disconnected
        if (!this.manualDisconnect && reason !== 'io client disconnect') {
          this._scheduleReconnect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error.message);
        this._emitEvent('connection:error', { error: error.message });

        // Attempt reconnection
        if (!this.manualDisconnect) {
          this._scheduleReconnect();
        }
      });

      // Set up message handlers for all possible events
      this._setupMessageHandlers();

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this._emitEvent('connection:error', { error: error.message });
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    this.manualDisconnect = true;

    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.subscriptions.clear();

    console.log('WebSocket disconnected manually');
  }

  /**
   * Subscribe to a specific event type
   * @param {string} event - Event name to subscribe to
   * @param {Function} callback - Callback function to handle the event
   */
  subscribe(event, callback) {
    if (typeof callback !== 'function') {
      console.error('Callback must be a function');
      return;
    }

    // Add callback to event handlers
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);

    // Send subscription message to server for server-side events
    if (this._isServerSubscriptionEvent(event)) {
      this._sendSubscription(event);
    }
  }

  /**
   * Unsubscribe from a specific event type
   * @param {string} event - Event name to unsubscribe from
   * @param {Function} callback - Optional specific callback to remove
   */
  unsubscribe(event, callback = null) {
    if (!this.eventHandlers.has(event)) {
      return;
    }

    if (callback) {
      // Remove specific callback
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }

      // If no more handlers, remove the event entirely
      if (handlers.length === 0) {
        this.eventHandlers.delete(event);
        if (this._isServerSubscriptionEvent(event)) {
          this._sendUnsubscription(event);
        }
      }
    } else {
      // Remove all callbacks for this event
      this.eventHandlers.delete(event);
      if (this._isServerSubscriptionEvent(event)) {
        this._sendUnsubscription(event);
      }
    }
  }

  /**
   * Check if currently connected
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get the number of reconnection attempts
   * @returns {number} Number of reconnection attempts
   */
  getReconnectAttempts() {
    return this.reconnectAttempts;
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this._emitEvent('connection:failed', { 
        attempts: this.reconnectAttempts 
      });
      return;
    }

    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this._emitEvent('connection:reconnecting', { 
        attempt: this.reconnectAttempts,
        delay 
      });

      // Attempt to reconnect
      if (this.socket) {
        this.socket.connect();
      } else {
        this.connect(this.url);
      }
    }, delay);
  }

  /**
   * Re-subscribe to all previous subscriptions after reconnection
   * @private
   */
  _resubscribeAll() {
    for (const subscription of this.subscriptions) {
      if (this.socket && this.isConnected) {
        this.socket.emit(subscription);
      }
    }
  }

  /**
   * Send subscription message to server
   * @private
   */
  _sendSubscription(event) {
    const subscriptionEvent = this._getSubscriptionEventName(event);
    if (subscriptionEvent && this.socket && this.isConnected) {
      this.socket.emit(subscriptionEvent);
      this.subscriptions.add(subscriptionEvent);
    }
  }

  /**
   * Send unsubscription message to server
   * @private
   */
  _sendUnsubscription(event) {
    const unsubscriptionEvent = this._getUnsubscriptionEventName(event);
    if (unsubscriptionEvent && this.socket && this.isConnected) {
      this.socket.emit(unsubscriptionEvent);
      this.subscriptions.delete(this._getSubscriptionEventName(event));
    }
  }

  /**
   * Check if event requires server-side subscription
   * @private
   */
  _isServerSubscriptionEvent(event) {
    const serverEvents = [
      'device:discovered',
      'device:status',
      'traffic:update',
      'health:update',
      'scan:complete'
    ];
    return serverEvents.includes(event);
  }

  /**
   * Get subscription event name for server
   * @private
   */
  _getSubscriptionEventName(event) {
    const mapping = {
      'device:discovered': 'subscribe:devices',
      'device:status': 'subscribe:devices',
      'traffic:update': 'subscribe:traffic',
      'health:update': 'subscribe:health',
      'scan:complete': 'subscribe:devices'
    };
    return mapping[event];
  }

  /**
   * Get unsubscription event name for server
   * @private
   */
  _getUnsubscriptionEventName(event) {
    const mapping = {
      'device:discovered': 'unsubscribe:devices',
      'device:status': 'unsubscribe:devices',
      'traffic:update': 'unsubscribe:traffic',
      'health:update': 'unsubscribe:health',
      'scan:complete': 'unsubscribe:devices'
    };
    return mapping[event];
  }

  /**
   * Set up message handlers for all server events
   * @private
   */
  _setupMessageHandlers() {
    if (!this.socket) return;

    const serverEvents = [
      'device:discovered',
      'device:status',
      'traffic:update',
      'health:update',
      'scan:complete'
    ];

    serverEvents.forEach(event => {
      this.socket.on(event, (data) => {
        try {
          // Handle message parsing errors gracefully
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (parseError) {
              console.error(`Failed to parse message for event ${event}:`, parseError);
              this._emitEvent('message:error', { 
                event, 
                error: 'Failed to parse message',
                rawData: data 
              });
              return;
            }
          }

          // Emit the event to all registered handlers
          this._emitEvent(event, data);
        } catch (error) {
          console.error(`Error handling event ${event}:`, error);
          this._emitEvent('message:error', { 
            event, 
            error: error.message 
          });
        }
      });
    });
  }

  /**
   * Emit an event to all registered handlers
   * @private
   */
  _emitEvent(event, data) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;
