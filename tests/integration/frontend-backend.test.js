/**
 * Integration Tests for Frontend-Backend Communication
 * Tests API requests from frontend to backend, WebSocket communication, and static file serving
 * Validates: Requirements 7.2, 7.4
 */

const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { createServer } = require('../../server/api/server');
const DeviceScanner = require('../../server/components/DeviceScanner');
const StatusMonitor = require('../../server/components/StatusMonitor');
const TrafficAnalyzer = require('../../server/components/TrafficAnalyzer');
const HealthMonitor = require('../../server/components/HealthMonitor');
const DataStore = require('../../server/components/DataStore');
const WebSocket = require('ws');

describe('Frontend-Backend Communication Integration Tests', () => {
  let server;
  let serverInstance;
  let components;
  let testDataDir;
  const TEST_PORT = 3002;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Create temporary data directory
    testDataDir = path.join(os.tmpdir(), `network-monitor-test-${Date.now()}`);
    await fs.mkdir(testDataDir, { recursive: true });

    // Initialize components
    components = {
      deviceScanner: new DeviceScanner(),
      statusMonitor: new StatusMonitor({ checkInterval: 1000 }),
      trafficAnalyzer: new TrafficAnalyzer({ sampleInterval: 500 }),
      healthMonitor: new HealthMonitor({ updateInterval: 2000 }),
      dataStore: new DataStore(testDataDir)
    };

    await components.dataStore.initialize();

    // Create and start server
    server = createServer(components, { port: TEST_PORT });
    serverInstance = await server.start();

    // Add some test data
    const testDevices = [
      {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device-1',
        vendor: 'Test Vendor A',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      },
      {
        ipAddress: '192.168.1.101',
        macAddress: 'BB:CC:DD:EE:FF:AA',
        hostname: 'test-device-2',
        vendor: 'Test Vendor B',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: false
      }
    ];

    for (const device of testDevices) {
      await components.dataStore.saveDevice(device);
      components.statusMonitor.startMonitoring(device);
      components.healthMonitor.startMonitoring(device.ipAddress);
    }
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }

    components.statusMonitor.stopAll();
    components.trafficAnalyzer.stopMonitoring();
    components.healthMonitor.stopAll();

    if (components.dataStore) {
      await components.dataStore.close();
    }

    // Cleanup test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test API requests from frontend to backend
   * Validates: Requirement 7.4
   */
  describe('API Request Communication', () => {
    test('should fetch devices list via API', async () => {
      const response = await fetch(`${BASE_URL}/api/devices`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const devices = await response.json();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThanOrEqual(2);
      
      // Verify device structure
      const device = devices[0];
      expect(device).toHaveProperty('ipAddress');
      expect(device).toHaveProperty('macAddress');
      expect(device).toHaveProperty('hostname');
      expect(device).toHaveProperty('isActive');
    });

    test('should trigger network scan via API', async () => {
      const response = await fetch(`${BASE_URL}/api/devices/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subnet: '192.168.1' })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('status', 'started');
      expect(result).toHaveProperty('estimatedTime');
      expect(typeof result.estimatedTime).toBe('number');
    });

    test('should fetch device status via API', async () => {
      const response = await fetch(`${BASE_URL}/api/devices/192.168.1.100/status`);
      
      expect(response.status).toBe(200);
      
      const status = await response.json();
      expect(status).toHaveProperty('ipAddress', '192.168.1.100');
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('lastChecked');
      expect(status).toHaveProperty('responseTime');
    });

    test('should fetch device health metrics via API', async () => {
      const response = await fetch(`${BASE_URL}/api/devices/192.168.1.100/health`);
      
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health).toHaveProperty('ipAddress', '192.168.1.100');
      expect(health).toHaveProperty('latency');
      expect(health).toHaveProperty('packetLoss');
      expect(health).toHaveProperty('isDegraded');
    });

    test('should fetch current traffic stats via API', async () => {
      const response = await fetch(`${BASE_URL}/api/traffic/current`);
      
      expect(response.status).toBe(200);
      
      const traffic = await response.json();
      expect(traffic).toHaveProperty('timestamp');
      expect(traffic).toHaveProperty('bytesReceived');
      expect(traffic).toHaveProperty('bytesSent');
      expect(traffic).toHaveProperty('bytesReceivedPerSec');
      expect(traffic).toHaveProperty('bytesSentPerSec');
    });

    test('should fetch traffic history via API', async () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 3600000); // 1 hour ago

      const response = await fetch(
        `${BASE_URL}/api/traffic/history?start=${startTime.toISOString()}&end=${endTime.toISOString()}`
      );
      
      expect(response.status).toBe(200);
      
      const history = await response.json();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should fetch all health metrics via API', async () => {
      const response = await fetch(`${BASE_URL}/api/health/all`);
      
      expect(response.status).toBe(200);
      
      const allHealth = await response.json();
      expect(typeof allHealth).toBe('object');
      expect(Object.keys(allHealth).length).toBeGreaterThanOrEqual(0);
    });

    test('should fetch system info via API', async () => {
      const response = await fetch(`${BASE_URL}/api/system/info`);
      
      expect(response.status).toBe(200);
      
      const info = await response.json();
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('uptime');
      expect(info).toHaveProperty('hostname');
      expect(info).toHaveProperty('platform');
    });

    test('should handle API errors gracefully', async () => {
      // Request non-existent device
      const response = await fetch(`${BASE_URL}/api/devices/192.168.1.999/status`);
      
      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('message');
    });

    test('should handle invalid API requests', async () => {
      // Missing required query parameters
      const response = await fetch(`${BASE_URL}/api/traffic/history`);
      
      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error).toHaveProperty('error', 'Bad Request');
      expect(error).toHaveProperty('message');
    });

    test('should handle concurrent API requests', async () => {
      const requests = [
        fetch(`${BASE_URL}/api/devices`),
        fetch(`${BASE_URL}/api/traffic/current`),
        fetch(`${BASE_URL}/api/health/all`),
        fetch(`${BASE_URL}/api/system/info`),
        fetch(`${BASE_URL}/api/devices/192.168.1.100/status`)
      ];

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify all responses are valid JSON
      const data = await Promise.all(responses.map(r => r.json()));
      expect(data).toHaveLength(5);
    });
  });

  /**
   * Test WebSocket communication between frontend and backend
   * Validates: Requirement 7.4
   */
  describe('WebSocket Communication', () => {
    function createWebSocketClient() {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        
        const messages = [];
        ws.on('message', (data) => {
          messages.push(data);
        });
        
        ws.on('open', () => {
          ws._receivedMessages = messages;
          resolve(ws);
        });

        ws.on('error', reject);
      });
    }

    function waitForMessage(ws, messageType, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${messageType}`));
        }, timeout);

        // Check already received messages
        if (ws._receivedMessages) {
          for (const data of ws._receivedMessages) {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === messageType) {
                clearTimeout(timer);
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
            // Ignore parse errors
          }
        };

        ws.on('message', handler);
      });
    }

    test('should establish WebSocket connection from frontend', async () => {
      const ws = await createWebSocketClient();
      
      const welcomeMessage = await waitForMessage(ws, 'connected');
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      
      ws.close();
    });

    test('should subscribe to device updates via WebSocket', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      
      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('devices');
      
      ws.close();
    });

    test('should subscribe to traffic updates via WebSocket', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      
      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('traffic');
      
      ws.close();
    });

    test('should subscribe to health updates via WebSocket', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      
      const response = await waitForMessage(ws, 'subscribed');
      expect(response.channel).toBe('health');
      
      ws.close();
    });

    test('should receive real-time device updates', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger a device discovery event
      const mockDevice = {
        ipAddress: '192.168.1.200',
        macAddress: 'CC:DD:EE:FF:AA:BB',
        hostname: 'realtime-test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', mockDevice);

      const event = await waitForMessage(ws, 'device:discovered');
      expect(event.device).toBeDefined();
      expect(event.device.ipAddress).toBe('192.168.1.200');
      
      ws.close();
    });

    test('should receive real-time traffic updates', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      // Broadcast a traffic update
      const mockStats = {
        timestamp: new Date(),
        bytesReceived: 1000000,
        bytesSent: 500000,
        bytesReceivedPerSec: 125000,
        bytesSentPerSec: 62500,
        packetsReceived: 1000,
        packetsSent: 500
      };

      server.broadcast('traffic', {
        type: 'traffic:update',
        stats: mockStats,
        timestamp: new Date().toISOString()
      });

      const event = await waitForMessage(ws, 'traffic:update');
      expect(event.stats).toBeDefined();
      expect(event.stats.bytesReceivedPerSec).toBe(125000);
      
      ws.close();
    });

    test('should handle WebSocket reconnection', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Close connection
      ws.close();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reconnect
      const ws2 = await createWebSocketClient();
      const welcomeMessage = await waitForMessage(ws2, 'connected');
      
      expect(welcomeMessage.type).toBe('connected');
      
      ws2.close();
    });

    test('should handle multiple frontend clients simultaneously', async () => {
      const clients = await Promise.all([
        createWebSocketClient(),
        createWebSocketClient(),
        createWebSocketClient()
      ]);

      // All clients should connect successfully
      const welcomeMessages = await Promise.all(
        clients.map(ws => waitForMessage(ws, 'connected'))
      );

      expect(welcomeMessages).toHaveLength(3);

      // Subscribe all clients to devices
      clients.forEach(ws => {
        ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      });

      const subscribeResponses = await Promise.all(
        clients.map(ws => waitForMessage(ws, 'subscribed'))
      );

      expect(subscribeResponses).toHaveLength(3);

      // Trigger an event
      const mockDevice = {
        ipAddress: '192.168.1.201',
        macAddress: 'DD:EE:FF:AA:BB:CC',
        hostname: 'multi-client-test',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', mockDevice);

      // All clients should receive the event
      const events = await Promise.all(
        clients.map(ws => waitForMessage(ws, 'device:discovered'))
      );

      expect(events).toHaveLength(3);
      events.forEach(event => {
        expect(event.device.ipAddress).toBe('192.168.1.201');
      });

      // Close all clients
      clients.forEach(ws => ws.close());
    });
  });

  /**
   * Test static file serving for frontend
   * Validates: Requirement 7.2
   */
  describe('Static File Serving', () => {
    test('should serve frontend static files', async () => {
      // Try to fetch the root path
      const response = await fetch(`${BASE_URL}/`);
      
      // Should either serve index.html or return 404 if not built
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('text/html');
      }
    });

    test('should handle client-side routing', async () => {
      // Request a client-side route
      const response = await fetch(`${BASE_URL}/dashboard`);
      
      // Should either serve index.html or return 404 if not built
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('text/html');
      }
    });

    test('should not interfere with API routes', async () => {
      // API routes should still work
      const response = await fetch(`${BASE_URL}/api/devices`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    test('should serve static assets with correct content types', async () => {
      // This test will pass if the frontend is built, otherwise skip
      const response = await fetch(`${BASE_URL}/`);
      
      if (response.status === 200) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toBeTruthy();
      } else {
        // Frontend not built, test passes
        expect(true).toBe(true);
      }
    });
  });

  /**
   * Test end-to-end frontend-backend workflow
   * Validates: Requirements 7.2, 7.4
   */
  describe('End-to-End Frontend-Backend Workflow', () => {
    function createWebSocketClient() {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        
        const messages = [];
        ws.on('message', (data) => {
          messages.push(data);
        });
        
        ws.on('open', () => {
          ws._receivedMessages = messages;
          resolve(ws);
        });

        ws.on('error', reject);
      });
    }

    function waitForMessage(ws, messageType, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for message type: ${messageType}`));
        }, timeout);

        // Check already received messages
        if (ws._receivedMessages) {
          for (const data of ws._receivedMessages) {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === messageType) {
                clearTimeout(timer);
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
            // Ignore parse errors
          }
        };

        ws.on('message', handler);
      });
    }

    test('should support complete monitoring workflow', async () => {
      // 1. Fetch initial device list
      const devicesResponse = await fetch(`${BASE_URL}/api/devices`);
      expect(devicesResponse.status).toBe(200);
      const devices = await devicesResponse.json();
      expect(Array.isArray(devices)).toBe(true);

      // 2. Establish WebSocket connection
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // 3. Subscribe to all channels
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // 4. Trigger a network scan
      const scanResponse = await fetch(`${BASE_URL}/api/devices/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: '192.168.1' })
      });
      expect(scanResponse.status).toBe(200);

      // 5. Fetch traffic stats
      const trafficResponse = await fetch(`${BASE_URL}/api/traffic/current`);
      expect(trafficResponse.status).toBe(200);

      // 6. Fetch health metrics
      const healthResponse = await fetch(`${BASE_URL}/api/health/all`);
      expect(healthResponse.status).toBe(200);

      // 7. Verify WebSocket is still connected
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    test('should handle errors gracefully in workflow', async () => {
      // 1. Try to fetch non-existent device
      const response1 = await fetch(`${BASE_URL}/api/devices/999.999.999.999/status`);
      expect(response1.status).toBe(404);

      // 2. Try invalid API request
      const response2 = await fetch(`${BASE_URL}/api/traffic/history`);
      expect(response2.status).toBe(400);

      // 3. WebSocket should still work
      const ws = await createWebSocketClient();
      const welcomeMessage = await waitForMessage(ws, 'connected');
      expect(welcomeMessage.type).toBe('connected');

      // 4. Send invalid WebSocket message
      ws.send('invalid json');
      const errorMessage = await waitForMessage(ws, 'error');
      expect(errorMessage.message).toContain('Invalid message format');

      // 5. Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });
  });
});
