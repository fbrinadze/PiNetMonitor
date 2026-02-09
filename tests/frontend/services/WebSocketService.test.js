/**
 * Unit tests for WebSocketService
 * Tests connection management, subscription handling, reconnection logic, and error handling
 * Requirements: 5.5, 5.6
 */

// Mock socket.io-client before importing WebSocketService
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockIo = jest.fn(() => mockSocket);

jest.mock('socket.io-client', () => ({
  io: mockIo
}));

// Import WebSocketService after mocking
import webSocketService from '../../../client/src/services/WebSocketService.js';

describe('WebSocketService', () => {
  beforeEach(() => {
    // Reset the service state
    if (webSocketService.socket) {
      webSocketService.disconnect();
    }
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any timers
    jest.clearAllTimers();
  });

  describe('Connection Management', () => {
    test('should connect to WebSocket server', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);

      expect(mockIo).toHaveBeenCalledWith(url, expect.objectContaining({
        autoConnect: true,
        reconnection: false,
        transports: ['websocket', 'polling']
      }));
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    test('should not connect if already connected', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Clear mocks and try to connect again
      mockIo.mockClear();
      webSocketService.connect(url);

      expect(mockIo).not.toHaveBeenCalled();
    });

    test('should disconnect from WebSocket server', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);
      webSocketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(webSocketService.getConnectionStatus()).toBe(false);
    });

    test('should update connection status on connect', () => {
      const url = 'http://localhost:3000';
      const statusCallback = jest.fn();
      
      webSocketService.subscribe('connection:status', statusCallback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      expect(webSocketService.getConnectionStatus()).toBe(true);
      expect(statusCallback).toHaveBeenCalledWith({ connected: true });
    });

    test('should update connection status on disconnect', () => {
      const url = 'http://localhost:3000';
      const statusCallback = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('connection:status', statusCallback);

      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');

      expect(webSocketService.getConnectionStatus()).toBe(false);
      expect(statusCallback).toHaveBeenCalledWith({ 
        connected: false, 
        reason: 'transport close' 
      });
    });

    test('should handle connection errors', () => {
      const url = 'http://localhost:3000';
      const errorCallback = jest.fn();
      
      webSocketService.subscribe('connection:error', errorCallback);
      webSocketService.connect(url);

      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
      errorHandler(new Error('Connection failed'));

      expect(errorCallback).toHaveBeenCalledWith({ 
        error: 'Connection failed' 
      });
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to events', () => {
      const callback = jest.fn();
      
      webSocketService.subscribe('device:discovered', callback);

      // Verify callback is registered (we'll test emission separately)
      expect(callback).not.toHaveBeenCalled();
    });

    test('should send subscription message to server for server events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('device:discovered', callback);

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:devices');
    });

    test('should not send subscription for non-server events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      mockSocket.emit.mockClear();
      webSocketService.subscribe('connection:status', callback);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('should unsubscribe from events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('device:discovered', callback);
      mockSocket.emit.mockClear();
      
      webSocketService.unsubscribe('device:discovered', callback);

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:devices');
    });

    test('should unsubscribe all callbacks for an event', () => {
      const url = 'http://localhost:3000';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('traffic:update', callback1);
      webSocketService.subscribe('traffic:update', callback2);
      mockSocket.emit.mockClear();
      
      webSocketService.unsubscribe('traffic:update');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:traffic');
    });

    test('should handle multiple callbacks for same event', () => {
      const url = 'http://localhost:3000';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('device:status', callback1);
      webSocketService.subscribe('device:status', callback2);

      // Simulate receiving event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'device:status')[1];
      const testData = { ipAddress: '192.168.1.100', isOnline: true };
      eventHandler(testData);

      expect(callback1).toHaveBeenCalledWith(testData);
      expect(callback2).toHaveBeenCalledWith(testData);
    });

    test('should re-subscribe after reconnection', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      webSocketService.subscribe('health:update', callback);
      mockSocket.emit.mockClear();

      // Simulate disconnection and reconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');
      
      connectHandler();

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:health');
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should attempt reconnection on disconnect', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');

      expect(webSocketService.getReconnectAttempts()).toBe(0);

      // Fast-forward time to trigger reconnection
      jest.advanceTimersByTime(1000);

      expect(webSocketService.getReconnectAttempts()).toBe(1);
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    test('should use exponential backoff for reconnection', () => {
      const url = 'http://localhost:3000';
      const reconnectCallback = jest.fn();
      
      webSocketService.subscribe('connection:reconnecting', reconnectCallback);
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');

      // First reconnection attempt (1 second delay)
      jest.advanceTimersByTime(1000);
      expect(reconnectCallback).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 1,
        delay: 1000
      }));

      // Simulate another disconnection
      disconnectHandler('transport close');

      // Second reconnection attempt (2 second delay)
      jest.advanceTimersByTime(2000);
      expect(reconnectCallback).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 2,
        delay: 2000
      }));
    });

    test('should not reconnect on manual disconnect', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      mockSocket.connect.mockClear();
      webSocketService.disconnect();

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    test('should stop reconnecting after max attempts', () => {
      const url = 'http://localhost:3000';
      const failedCallback = jest.fn();
      
      webSocketService.subscribe('connection:failed', failedCallback);
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');

      // Simulate 10 failed reconnection attempts
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(Math.pow(2, i) * 1000);
        disconnectHandler('transport close');
      }

      // Try one more time - should fail
      jest.advanceTimersByTime(30000);

      expect(failedCallback).toHaveBeenCalledWith(expect.objectContaining({
        attempts: 10
      }));
    });

    test('should reset reconnection attempts on successful connection', () => {
      const url = 'http://localhost:3000';
      
      webSocketService.connect(url);
      
      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler('transport close');

      // First reconnection attempt
      jest.advanceTimersByTime(1000);
      expect(webSocketService.getReconnectAttempts()).toBe(1);

      // Simulate successful reconnection
      connectHandler();
      expect(webSocketService.getReconnectAttempts()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle message parsing errors gracefully', () => {
      const url = 'http://localhost:3000';
      const errorCallback = jest.fn();
      const dataCallback = jest.fn();
      
      webSocketService.subscribe('message:error', errorCallback);
      webSocketService.subscribe('device:discovered', dataCallback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving invalid JSON string
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'device:discovered')[1];
      eventHandler('invalid json {');

      expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({
        event: 'device:discovered',
        error: 'Failed to parse message'
      }));
      expect(dataCallback).not.toHaveBeenCalled();
    });

    test('should handle valid JSON string messages', () => {
      const url = 'http://localhost:3000';
      const dataCallback = jest.fn();
      
      webSocketService.subscribe('traffic:update', dataCallback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving valid JSON string
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'traffic:update')[1];
      const testData = { bytesReceivedPerSec: 1000, bytesSentPerSec: 500 };
      eventHandler(JSON.stringify(testData));

      expect(dataCallback).toHaveBeenCalledWith(testData);
    });

    test('should handle errors in event callbacks', () => {
      const url = 'http://localhost:3000';
      const faultyCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();
      
      webSocketService.subscribe('health:update', faultyCallback);
      webSocketService.subscribe('health:update', goodCallback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'health:update')[1];
      const testData = { ipAddress: '192.168.1.100', latency: 15 };
      
      // Should not throw
      expect(() => eventHandler(testData)).not.toThrow();
      
      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalledWith(testData);
    });

    test('should reject non-function callbacks', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      webSocketService.subscribe('device:status', 'not a function');

      expect(consoleSpy).toHaveBeenCalledWith('Callback must be a function');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Emission', () => {
    test('should emit device:discovered events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.subscribe('device:discovered', callback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving device:discovered event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'device:discovered')[1];
      const deviceData = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device'
      };
      eventHandler(deviceData);

      expect(callback).toHaveBeenCalledWith(deviceData);
    });

    test('should emit traffic:update events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.subscribe('traffic:update', callback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving traffic:update event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'traffic:update')[1];
      const trafficData = {
        bytesReceivedPerSec: 1000,
        bytesSentPerSec: 500
      };
      eventHandler(trafficData);

      expect(callback).toHaveBeenCalledWith(trafficData);
    });

    test('should emit scan:complete events', () => {
      const url = 'http://localhost:3000';
      const callback = jest.fn();
      
      webSocketService.subscribe('scan:complete', callback);
      webSocketService.connect(url);

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();

      // Simulate receiving scan:complete event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'scan:complete')[1];
      const scanData = { deviceCount: 5 };
      eventHandler(scanData);

      expect(callback).toHaveBeenCalledWith(scanData);
    });
  });
});
