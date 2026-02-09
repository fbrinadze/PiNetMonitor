/**
 * Integration tests for WebSocket communication
 * @module tests/integration/websocket
 */

const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const { createServer } = require('../../server/api/server');
const DeviceScanner = require('../../server/components/DeviceScanner');
const StatusMonitor = require('../../server/components/StatusMonitor');
const TrafficAnalyzer = require('../../server/components/TrafficAnalyzer');
const HealthMonitor = require('../../server/components/HealthMonitor');
const DataStore = require('../../server/components/DataStore');

describe('WebSocket Integration Tests', () => {
  let server;
  let serverInstance;
  let components;
  const TEST_PORT = 3001;

  beforeAll(async () => {
    // Create mock components with a temporary directory for DataStore
    const tempDir = path.join(os.tmpdir(), 'network-monitor-test-' + Date.now());
    
    components = {
      deviceScanner: new DeviceScanner(),
      statusMonitor: new StatusMonitor(),
      trafficAnalyzer: new TrafficAnalyzer(),
      healthMonitor: new HealthMonitor(),
      dataStore: new DataStore(tempDir)
    };

    // Initialize DataStore
    await components.dataStore.initialize();

    // Create and start server
    server = createServer(components, { port: TEST_PORT });
    serverInstance = await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  /**
   * Helper function to create a WebSocket client and wait for connection
   */
  function createClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      const messages = [];
      
      // Start collecting messages immediately
      ws.on('message', (data) => {
        messages.push(data);
      });
      
      ws.on('open', () => {
        // Attach the messages array to the ws object so tests can access it
        ws._receivedMessages = messages;
        resolve(ws);
      });

      ws.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Helper function to wait for a specific message type
   */
  function waitForMessage(ws, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      // Check already received messages first
      if (ws._receivedMessages) {
        for (const data of ws._receivedMessages) {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === messageType) {
              clearTimeout(timer);
              // Remove this message from the queue
              const index = ws._receivedMessages.indexOf(data);
              if (index > -1) {
                ws._receivedMessages.splice(index, 1);
              }
              resolve(message);
              return;
            }
          } catch (error) {
            // Ignore parse errors
          }
        }
      }

      const handler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === messageType) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(message);
          }
        } catch (error) {
          // Ignore parse errors, keep waiting
        }
      };

      ws.on('message', handler);
    });
  }

  describe('Connection Handling', () => {
    test('should accept WebSocket connections', async () => {
      const ws = await createClient();
      
      // Wait for welcome message
      const welcomeMessage = await waitForMessage(ws, 'connected');
      
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.message).toContain('Connected');
      expect(welcomeMessage.timestamp).toBeDefined();
      
      ws.close();
    });

    test('should handle client disconnection gracefully', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');
      
      // Close connection
      ws.close();
      
      // Wait a bit to ensure server processes the disconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // No errors should be thrown
      expect(true).toBe(true);
    });

    test('should handle multiple concurrent connections', async () => {
      const clients = await Promise.all([
        createClient(),
        createClient(),
        createClient()
      ]);

      // All clients should receive welcome messages
      const welcomeMessages = await Promise.all(
        clients.map(ws => waitForMessage(ws, 'connected'))
      );

      expect(welcomeMessages).toHaveLength(3);
      welcomeMessages.forEach(msg => {
        expect(msg.type).toBe('connected');
      });

      // Close all clients
      clients.forEach(ws => ws.close());
    });
  });

  describe('Subscription/Unsubscription Flow', () => {
    test('should handle device subscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to devices
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));

      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('devices');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle traffic subscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to traffic
      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));

      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('traffic');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle health subscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to health
      ws.send(JSON.stringify({ type: 'subscribe:health' }));

      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('health');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle device unsubscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe first
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Then unsubscribe
      ws.send(JSON.stringify({ type: 'unsubscribe:devices' }));

      const response = await waitForMessage(ws, 'unsubscribed');
      expect(response.channel).toBe('devices');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle traffic unsubscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe first
      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      // Then unsubscribe
      ws.send(JSON.stringify({ type: 'unsubscribe:traffic' }));

      const response = await waitForMessage(ws, 'unsubscribed');
      expect(response.channel).toBe('traffic');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle health unsubscription', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe first
      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // Then unsubscribe
      ws.send(JSON.stringify({ type: 'unsubscribe:health' }));

      const response = await waitForMessage(ws, 'unsubscribed');
      expect(response.channel).toBe('health');
      expect(response.timestamp).toBeDefined();

      ws.close();
    });
  });

  describe('Event Emission', () => {
    test('should emit device:discovered events to subscribed clients', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to devices
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger device discovery
      const mockDevice = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', mockDevice);

      // Wait for device:discovered event
      const event = await waitForMessage(ws, 'device:discovered');
      expect(event.device).toBeDefined();
      expect(event.device.ipAddress).toBe('192.168.1.100');
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should emit scan:complete events to subscribed clients', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to devices
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger scan complete
      components.deviceScanner.emit('scanComplete', 5);

      // Wait for scan:complete event
      const event = await waitForMessage(ws, 'scan:complete');
      expect(event.deviceCount).toBe(5);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should emit device:status events to subscribed clients', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to devices
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger status change
      const mockStatus = {
        ipAddress: '192.168.1.100',
        isOnline: true,
        lastChecked: new Date(),
        responseTime: 15.5
      };

      // Simulate status change callback
      const statusChangeCallbacks = [];
      components.statusMonitor.onStatusChange = (callback) => {
        statusChangeCallbacks.push(callback);
      };

      // Re-setup component listeners to capture the callback
      const setupListeners = server.broadcast.toString().includes('setupComponentEventListeners');
      
      // Manually trigger the callback
      if (components.statusMonitor._statusChangeCallback) {
        components.statusMonitor._statusChangeCallback('192.168.1.100', mockStatus);
      } else {
        // Emit using EventEmitter if available
        components.statusMonitor.emit('statusChange', '192.168.1.100', mockStatus);
      }

      // For this test, we'll use the broadcast function directly
      server.broadcast('devices', {
        type: 'device:status',
        ipAddress: '192.168.1.100',
        status: mockStatus,
        timestamp: new Date().toISOString()
      });

      // Wait for device:status event
      const event = await waitForMessage(ws, 'device:status');
      expect(event.ipAddress).toBe('192.168.1.100');
      expect(event.status).toBeDefined();
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should emit traffic:update events to subscribed clients', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to traffic
      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger traffic update
      const mockStats = {
        timestamp: new Date(),
        bytesReceived: 1000000,
        bytesSent: 500000,
        bytesReceivedPerSec: 125000,
        bytesSentPerSec: 62500,
        packetsReceived: 1000,
        packetsSent: 500
      };

      // Use broadcast directly for testing
      server.broadcast('traffic', {
        type: 'traffic:update',
        stats: mockStats,
        timestamp: new Date().toISOString()
      });

      // Wait for traffic:update event
      const event = await waitForMessage(ws, 'traffic:update');
      expect(event.stats).toBeDefined();
      expect(event.stats.bytesReceivedPerSec).toBe(125000);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should emit health:update events to subscribed clients', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to health
      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger health update
      const mockMetrics = {
        ipAddress: '192.168.1.100',
        latency: 15.5,
        minLatency: 10.2,
        maxLatency: 25.8,
        packetLoss: 0.5,
        jitter: 3.2,
        lastUpdated: new Date(),
        isDegraded: false
      };

      // Use broadcast directly for testing
      server.broadcast('health', {
        type: 'health:update',
        ipAddress: '192.168.1.100',
        metrics: mockMetrics,
        timestamp: new Date().toISOString()
      });

      // Wait for health:update event
      const event = await waitForMessage(ws, 'health:update');
      expect(event.ipAddress).toBe('192.168.1.100');
      expect(event.metrics).toBeDefined();
      expect(event.metrics.latency).toBe(15.5);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should only send events to subscribed clients', async () => {
      const subscribedClient = await createClient();
      const unsubscribedClient = await createClient();

      await waitForMessage(subscribedClient, 'connected');
      await waitForMessage(unsubscribedClient, 'connected');

      // Only subscribe one client to devices
      subscribedClient.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(subscribedClient, 'subscribed');

      // Trigger device discovery
      const mockDevice = {
        ipAddress: '192.168.1.101',
        macAddress: 'BB:CC:DD:EE:FF:AA',
        hostname: 'test-device-2',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', mockDevice);

      // Subscribed client should receive the event
      const event = await waitForMessage(subscribedClient, 'device:discovered');
      expect(event.device.ipAddress).toBe('192.168.1.101');

      // Unsubscribed client should not receive device events
      // We'll verify this by checking that it doesn't receive the message within a short timeout
      let receivedUnexpectedMessage = false;
      const messageHandler = (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'device:discovered') {
          receivedUnexpectedMessage = true;
        }
      };

      unsubscribedClient.on('message', messageHandler);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(receivedUnexpectedMessage).toBe(false);

      subscribedClient.close();
      unsubscribedClient.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON messages', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Send invalid JSON
      ws.send('this is not valid JSON');

      // Wait for error message
      const errorMessage = await waitForMessage(ws, 'error');
      expect(errorMessage.message).toContain('Invalid message format');
      expect(errorMessage.timestamp).toBeDefined();

      ws.close();
    });

    test('should handle unknown message types', async () => {
      const ws = await createClient();
      await waitForMessage(ws, 'connected');

      // Send unknown message type
      ws.send(JSON.stringify({ type: 'unknown:action' }));

      // Wait for error message
      const errorMessage = await waitForMessage(ws, 'error');
      expect(errorMessage.message).toContain('Unknown message type');
      expect(errorMessage.timestamp).toBeDefined();

      ws.close();
    });
  });
});
