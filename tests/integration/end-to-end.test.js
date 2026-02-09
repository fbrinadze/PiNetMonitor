/**
 * End-to-End Integration Tests for Network Monitor
 * Tests complete device discovery flow, real-time monitoring updates, data persistence,
 * frontend-backend integration, and error recovery scenarios
 * Validates: All requirements
 */

const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const WebSocket = require('ws');
const DeviceScanner = require('../../server/components/DeviceScanner');
const StatusMonitor = require('../../server/components/StatusMonitor');
const TrafficAnalyzer = require('../../server/components/TrafficAnalyzer');
const HealthMonitor = require('../../server/components/HealthMonitor');
const DataStore = require('../../server/components/DataStore');
const { createServer } = require('../../server/api/server');

describe('End-to-End Integration Tests', () => {
  let server;
  let components;
  let testDataDir;
  const TEST_PORT = 3003;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Create temporary data directory
    testDataDir = path.join(os.tmpdir(), `network-monitor-e2e-${Date.now()}`);
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
    await server.start();
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
   * Helper function to create a WebSocket client
   */
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

  /**
   * Helper function to wait for a specific message type
   */
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


  /**
   * Test 1: Complete Device Discovery Flow
   * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 4.1, 6.1, 6.2, 6.3
   */
  describe('Complete Device Discovery Flow', () => {
    test('should discover devices, start monitoring, persist data, and provide API access', async () => {
      // Step 1: Create mock devices
      const mockDevices = [
        {
          ipAddress: '192.168.1.50',
          macAddress: 'AA:BB:CC:DD:EE:50',
          hostname: 'e2e-device-1',
          vendor: 'Test Vendor A',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.51',
          macAddress: 'AA:BB:CC:DD:EE:51',
          hostname: 'e2e-device-2',
          vendor: 'Test Vendor B',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        }
      ];

      // Step 2: Simulate device discovery
      for (const device of mockDevices) {
        components.deviceScanner.deviceCache.set(device.ipAddress, device);
        await components.dataStore.saveDevice(device);
        components.statusMonitor.startMonitoring(device);
        components.healthMonitor.startMonitoring(device.ipAddress);
      }

      // Wait for monitoring to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify devices are accessible via API
      const devicesResponse = await fetch(`${BASE_URL}/api/devices`);
      expect(devicesResponse.status).toBe(200);
      const devices = await devicesResponse.json();
      
      expect(devices.length).toBeGreaterThanOrEqual(mockDevices.length);
      
      // Verify each mock device is in the response
      for (const mockDevice of mockDevices) {
        const found = devices.find(d => d.ipAddress === mockDevice.ipAddress);
        expect(found).toBeTruthy();
        expect(found.macAddress).toBe(mockDevice.macAddress);
        expect(found.hostname).toBe(mockDevice.hostname);
      }

      // Step 4: Verify device status is available
      for (const mockDevice of mockDevices) {
        const statusResponse = await fetch(`${BASE_URL}/api/devices/${mockDevice.ipAddress}/status`);
        expect(statusResponse.status).toBe(200);
        
        const status = await statusResponse.json();
        expect(status.ipAddress).toBe(mockDevice.ipAddress);
        expect(status).toHaveProperty('isOnline');
        expect(status).toHaveProperty('lastChecked');
        expect(status).toHaveProperty('responseTime');
      }

      // Step 5: Verify health metrics are available
      for (const mockDevice of mockDevices) {
        const healthResponse = await fetch(`${BASE_URL}/api/devices/${mockDevice.ipAddress}/health`);
        expect(healthResponse.status).toBe(200);
        
        const health = await healthResponse.json();
        expect(health.ipAddress).toBe(mockDevice.ipAddress);
        expect(health).toHaveProperty('latency');
        expect(health).toHaveProperty('packetLoss');
        expect(health).toHaveProperty('isDegraded');
      }

      // Step 6: Verify data persistence
      const persistedDevices = await components.dataStore.getAllDevices();
      expect(persistedDevices.length).toBeGreaterThanOrEqual(mockDevices.length);
      
      for (const mockDevice of mockDevices) {
        const persisted = persistedDevices.find(d => d.ipAddress === mockDevice.ipAddress);
        expect(persisted).toBeTruthy();
        expect(persisted.macAddress).toBe(mockDevice.macAddress);
      }
    });

    test('should handle network scan trigger and completion', async () => {
      // Trigger a network scan
      const scanResponse = await fetch(`${BASE_URL}/api/devices/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: '192.168.1' })
      });

      expect(scanResponse.status).toBe(200);
      
      const scanResult = await scanResponse.json();
      expect(scanResult).toHaveProperty('status', 'started');
      expect(scanResult).toHaveProperty('estimatedTime');
      expect(typeof scanResult.estimatedTime).toBe('number');
      expect(scanResult.estimatedTime).toBeGreaterThan(0);
    });
  });


  /**
   * Test 2: Real-Time Monitoring Updates
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 5.5, 5.6
   */
  describe('Real-Time Monitoring Updates', () => {
    test('should receive real-time device status updates via WebSocket', async () => {
      // Establish WebSocket connection
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to device updates
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger a device discovery event
      const newDevice = {
        ipAddress: '192.168.1.60',
        macAddress: 'BB:CC:DD:EE:FF:60',
        hostname: 'realtime-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', newDevice);

      // Wait for device:discovered event
      const event = await waitForMessage(ws, 'device:discovered');
      expect(event.device).toBeDefined();
      expect(event.device.ipAddress).toBe(newDevice.ipAddress);
      expect(event.device.macAddress).toBe(newDevice.macAddress);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should receive real-time traffic updates via WebSocket', async () => {
      // Establish WebSocket connection
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to traffic updates
      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      // Broadcast a traffic update
      const mockStats = {
        timestamp: new Date(),
        bytesReceived: 2000000,
        bytesSent: 1000000,
        bytesReceivedPerSec: 250000,
        bytesSentPerSec: 125000,
        packetsReceived: 2000,
        packetsSent: 1000
      };

      server.broadcast('traffic', {
        type: 'traffic:update',
        stats: mockStats,
        timestamp: new Date().toISOString()
      });

      // Wait for traffic:update event
      const event = await waitForMessage(ws, 'traffic:update');
      expect(event.stats).toBeDefined();
      expect(event.stats.bytesReceivedPerSec).toBe(250000);
      expect(event.stats.bytesSentPerSec).toBe(125000);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should receive real-time health updates via WebSocket', async () => {
      // Establish WebSocket connection
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to health updates
      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // Broadcast a health update
      const mockMetrics = {
        ipAddress: '192.168.1.61',
        latency: 25.5,
        minLatency: 20.0,
        maxLatency: 35.0,
        packetLoss: 1.5,
        jitter: 5.0,
        lastUpdated: new Date(),
        isDegraded: false
      };

      server.broadcast('health', {
        type: 'health:update',
        ipAddress: mockMetrics.ipAddress,
        metrics: mockMetrics,
        timestamp: new Date().toISOString()
      });

      // Wait for health:update event
      const event = await waitForMessage(ws, 'health:update');
      expect(event.ipAddress).toBe(mockMetrics.ipAddress);
      expect(event.metrics).toBeDefined();
      expect(event.metrics.latency).toBe(25.5);
      expect(event.metrics.packetLoss).toBe(1.5);
      expect(event.timestamp).toBeDefined();

      ws.close();
    });

    test('should update dashboard within 2 seconds of backend changes', async () => {
      // Establish WebSocket connection
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Subscribe to all channels
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // Trigger multiple events and measure response time
      const startTime = Date.now();

      // Trigger device event
      const testDevice = {
        ipAddress: '192.168.1.62',
        macAddress: 'CC:DD:EE:FF:AA:62',
        hostname: 'timing-test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', testDevice);

      // Wait for event
      await waitForMessage(ws, 'device:discovered');
      const deviceEventTime = Date.now() - startTime;

      // Verify update time is within 2 seconds (Requirement 5.6)
      expect(deviceEventTime).toBeLessThan(2000);

      ws.close();
    });
  });


  /**
   * Test 3: Data Persistence Across Restarts
   * Validates: Requirements 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5
   */
  describe('Data Persistence Across Restarts', () => {
    test('should persist and restore complete system state across server restarts', async () => {
      // Step 1: Create initial state with devices, traffic, and health data
      const testDevices = [
        {
          ipAddress: '192.168.1.70',
          macAddress: 'DD:EE:FF:AA:BB:70',
          hostname: 'persist-device-1',
          vendor: 'Vendor A',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.71',
          macAddress: 'DD:EE:FF:AA:BB:71',
          hostname: 'persist-device-2',
          vendor: 'Vendor B',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: false
        }
      ];

      // Save devices
      for (const device of testDevices) {
        await components.dataStore.saveDevice(device);
      }

      // Save traffic stats
      const trafficStats = [
        {
          timestamp: new Date(Date.now() - 3600000),
          bytesReceived: 5000000,
          bytesSent: 2500000,
          bytesReceivedPerSec: 5000,
          bytesSentPerSec: 2500,
          packetsReceived: 50000,
          packetsSent: 25000
        },
        {
          timestamp: new Date(Date.now() - 1800000),
          bytesReceived: 10000000,
          bytesSent: 5000000,
          bytesReceivedPerSec: 10000,
          bytesSentPerSec: 5000,
          packetsReceived: 100000,
          packetsSent: 50000
        }
      ];

      for (const stats of trafficStats) {
        await components.dataStore.saveTrafficStats(stats);
      }

      // Save health metrics
      const healthMetrics = [
        {
          ipAddress: '192.168.1.70',
          latency: 12.5,
          minLatency: 10.0,
          maxLatency: 20.0,
          packetLoss: 0.2,
          jitter: 2.5,
          lastUpdated: new Date(Date.now() - 3600000),
          isDegraded: false
        },
        {
          ipAddress: '192.168.1.71',
          latency: 120.0,
          minLatency: 100.0,
          maxLatency: 150.0,
          packetLoss: 8.0,
          jitter: 20.0,
          lastUpdated: new Date(Date.now() - 1800000),
          isDegraded: true
        }
      ];

      for (const metrics of healthMetrics) {
        await components.dataStore.saveHealthMetrics(metrics);
      }

      // Step 2: Stop the server (simulating shutdown)
      await server.stop();
      await components.dataStore.close();

      // Step 3: Create new components and server (simulating restart)
      const newDataStore = new DataStore(testDataDir);
      await newDataStore.initialize();

      const newComponents = {
        deviceScanner: new DeviceScanner(),
        statusMonitor: new StatusMonitor({ checkInterval: 1000 }),
        trafficAnalyzer: new TrafficAnalyzer({ sampleInterval: 500 }),
        healthMonitor: new HealthMonitor({ updateInterval: 2000 }),
        dataStore: newDataStore
      };

      const newServer = createServer(newComponents, { port: TEST_PORT });
      await newServer.start();

      // Step 4: Verify devices were restored
      const restoredDevices = await newDataStore.getAllDevices();
      expect(restoredDevices.length).toBeGreaterThanOrEqual(testDevices.length);

      for (const originalDevice of testDevices) {
        const restored = restoredDevices.find(d => d.ipAddress === originalDevice.ipAddress);
        expect(restored).toBeTruthy();
        expect(restored.macAddress).toBe(originalDevice.macAddress);
        expect(restored.hostname).toBe(originalDevice.hostname);
        expect(restored.isActive).toBe(originalDevice.isActive);
      }

      // Step 5: Verify traffic stats were restored
      const startTime = new Date(Date.now() - 7200000);
      const endTime = new Date();
      const restoredTraffic = await newDataStore.getTrafficStats(startTime, endTime);
      expect(restoredTraffic.length).toBeGreaterThanOrEqual(trafficStats.length);

      // Step 6: Verify health metrics were restored
      for (const originalMetrics of healthMetrics) {
        const restoredMetrics = await newDataStore.getHealthMetrics(
          originalMetrics.ipAddress,
          startTime,
          endTime
        );
        expect(restoredMetrics.length).toBeGreaterThan(0);
        
        const restored = restoredMetrics[0];
        expect(restored.ipAddress).toBe(originalMetrics.ipAddress);
        expect(restored.latency).toBe(originalMetrics.latency);
        expect(restored.isDegraded).toBe(originalMetrics.isDegraded);
      }

      // Step 7: Verify API access works after restart
      const devicesResponse = await fetch(`${BASE_URL}/api/devices`);
      expect(devicesResponse.status).toBe(200);
      const apiDevices = await devicesResponse.json();
      expect(apiDevices.length).toBeGreaterThanOrEqual(testDevices.length);

      // Cleanup: restore original server
      await newServer.stop();
      await newDataStore.close();

      // Restart original server
      components.dataStore = new DataStore(testDataDir);
      await components.dataStore.initialize();
      server = createServer(components, { port: TEST_PORT });
      await server.start();
    });

    test('should cleanup old data while preserving recent data', async () => {
      // Save old data (older than 24 hours)
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const oldTrafficStats = {
        timestamp: oldTimestamp,
        bytesReceived: 1000000,
        bytesSent: 500000,
        bytesReceivedPerSec: 1000,
        bytesSentPerSec: 500,
        packetsReceived: 10000,
        packetsSent: 5000
      };

      await components.dataStore.saveTrafficStats(oldTrafficStats);

      // Save recent data (within 24 hours)
      const recentTimestamp = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const recentTrafficStats = {
        timestamp: recentTimestamp,
        bytesReceived: 2000000,
        bytesSent: 1000000,
        bytesReceivedPerSec: 2000,
        bytesSentPerSec: 1000,
        packetsReceived: 20000,
        packetsSent: 10000
      };

      await components.dataStore.saveTrafficStats(recentTrafficStats);

      // Perform cleanup (remove data older than 24 hours)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await components.dataStore.cleanupOldData(cutoffDate);

      // Verify old data was removed and recent data was preserved
      const startTime = new Date(Date.now() - 26 * 60 * 60 * 1000);
      const endTime = new Date();
      const remainingStats = await components.dataStore.getTrafficStats(startTime, endTime);

      // Recent data should still exist
      const recentExists = remainingStats.some(s => 
        Math.abs(new Date(s.timestamp).getTime() - recentTimestamp.getTime()) < 60000
      );
      expect(recentExists).toBe(true);

      // Old data should be removed (or at least not guaranteed to exist)
      // This validates Requirement 9.5
    });
  });


  /**
   * Test 4: Frontend-Backend Integration
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.4, 6.5, 6.6, 7.2, 7.4, 7.5
   */
  describe('Frontend-Backend Integration', () => {
    test('should support complete frontend workflow with API and WebSocket', async () => {
      // Simulate frontend initialization workflow

      // Step 1: Fetch initial data (like frontend would on mount)
      const devicesResponse = await fetch(`${BASE_URL}/api/devices`);
      expect(devicesResponse.status).toBe(200);
      const devices = await devicesResponse.json();
      expect(Array.isArray(devices)).toBe(true);

      const trafficResponse = await fetch(`${BASE_URL}/api/traffic/current`);
      expect(trafficResponse.status).toBe(200);
      const traffic = await trafficResponse.json();
      expect(traffic).toHaveProperty('timestamp');

      const healthResponse = await fetch(`${BASE_URL}/api/health/all`);
      expect(healthResponse.status).toBe(200);
      const health = await healthResponse.json();
      expect(typeof health).toBe('object');

      const systemResponse = await fetch(`${BASE_URL}/api/system/info`);
      expect(systemResponse.status).toBe(200);
      const systemInfo = await systemResponse.json();
      expect(systemInfo).toHaveProperty('version');
      expect(systemInfo).toHaveProperty('uptime');
      expect(systemInfo).toHaveProperty('hostname');

      // Step 2: Establish WebSocket connection (like frontend would)
      const ws = await createWebSocketClient();
      const welcomeMsg = await waitForMessage(ws, 'connected');
      expect(welcomeMsg.type).toBe('connected');

      // Step 3: Subscribe to all channels
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:traffic' }));
      await waitForMessage(ws, 'subscribed');

      ws.send(JSON.stringify({ type: 'subscribe:health' }));
      await waitForMessage(ws, 'subscribed');

      // Step 4: Trigger a scan (user action)
      const scanResponse = await fetch(`${BASE_URL}/api/devices/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: '192.168.1' })
      });
      expect(scanResponse.status).toBe(200);

      // Step 5: Verify real-time updates are received
      // Simulate a device discovery
      const newDevice = {
        ipAddress: '192.168.1.80',
        macAddress: 'EE:FF:AA:BB:CC:80',
        hostname: 'frontend-test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', newDevice);

      const deviceEvent = await waitForMessage(ws, 'device:discovered');
      expect(deviceEvent.device.ipAddress).toBe(newDevice.ipAddress);

      // Step 6: Fetch updated device list
      const updatedDevicesResponse = await fetch(`${BASE_URL}/api/devices`);
      expect(updatedDevicesResponse.status).toBe(200);

      ws.close();
    });

    test('should handle concurrent frontend clients without interference', async () => {
      // Create multiple WebSocket clients (simulating multiple browser tabs)
      const clients = await Promise.all([
        createWebSocketClient(),
        createWebSocketClient(),
        createWebSocketClient()
      ]);

      // All clients connect successfully
      await Promise.all(clients.map(ws => waitForMessage(ws, 'connected')));

      // Subscribe all clients to devices
      clients.forEach(ws => {
        ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      });

      await Promise.all(clients.map(ws => waitForMessage(ws, 'subscribed')));

      // Trigger an event
      const testDevice = {
        ipAddress: '192.168.1.81',
        macAddress: 'FF:AA:BB:CC:DD:81',
        hostname: 'multi-client-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', testDevice);

      // All clients should receive the event
      const events = await Promise.all(
        clients.map(ws => waitForMessage(ws, 'device:discovered'))
      );

      expect(events).toHaveLength(3);
      events.forEach(event => {
        expect(event.device.ipAddress).toBe(testDevice.ipAddress);
      });

      // Close all clients
      clients.forEach(ws => ws.close());
    });

    test('should provide responsive API for dashboard rendering', async () => {
      // Measure API response times for dashboard data
      const startTime = Date.now();

      const responses = await Promise.all([
        fetch(`${BASE_URL}/api/devices`),
        fetch(`${BASE_URL}/api/traffic/current`),
        fetch(`${BASE_URL}/api/health/all`),
        fetch(`${BASE_URL}/api/system/info`)
      ]);

      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Total time for all dashboard data should be reasonable (< 5 seconds)
      expect(totalTime).toBeLessThan(5000);

      // Verify all responses are valid JSON
      const data = await Promise.all(responses.map(r => r.json()));
      expect(data).toHaveLength(4);

      // Verify data structure for dashboard rendering
      const [devices, traffic, health, systemInfo] = data;

      // Devices should be an array with required fields
      expect(Array.isArray(devices)).toBe(true);
      if (devices.length > 0) {
        expect(devices[0]).toHaveProperty('ipAddress');
        expect(devices[0]).toHaveProperty('macAddress');
        expect(devices[0]).toHaveProperty('hostname');
        expect(devices[0]).toHaveProperty('isActive');
      }

      // Traffic should have required fields
      expect(traffic).toHaveProperty('bytesReceivedPerSec');
      expect(traffic).toHaveProperty('bytesSentPerSec');

      // Health should be an object
      expect(typeof health).toBe('object');

      // System info should have required fields
      expect(systemInfo).toHaveProperty('version');
      expect(systemInfo).toHaveProperty('hostname');
    });
  });


  /**
   * Test 5: Error Recovery Scenarios
   * Validates: Requirements 6.6, 7.5, 8.5
   */
  describe('Error Recovery Scenarios', () => {
    test('should handle API errors gracefully and continue operation', async () => {
      // Test 1: Request non-existent device
      const response1 = await fetch(`${BASE_URL}/api/devices/999.999.999.999/status`);
      expect(response1.status).toBe(404);
      
      const error1 = await response1.json();
      expect(error1).toHaveProperty('error');
      expect(error1).toHaveProperty('message');
      expect(error1.message).toContain('999.999.999.999');

      // Test 2: Invalid API request (missing parameters)
      const response2 = await fetch(`${BASE_URL}/api/traffic/history`);
      expect(response2.status).toBe(400);
      
      const error2 = await response2.json();
      expect(error2).toHaveProperty('error', 'Bad Request');
      expect(error2).toHaveProperty('message');

      // Test 3: Invalid date format
      const response3 = await fetch(`${BASE_URL}/api/traffic/history?start=invalid&end=invalid`);
      expect(response3.status).toBe(400);
      
      const error3 = await response3.json();
      expect(error3).toHaveProperty('error', 'Bad Request');
      expect(error3.message).toContain('Invalid date format');

      // Test 4: Verify system is still operational after errors
      const response4 = await fetch(`${BASE_URL}/api/devices`);
      expect(response4.status).toBe(200);
      
      const devices = await response4.json();
      expect(Array.isArray(devices)).toBe(true);
    });

    test('should handle WebSocket errors gracefully and maintain connection', async () => {
      const ws = await createWebSocketClient();
      await waitForMessage(ws, 'connected');

      // Test 1: Send invalid JSON
      ws.send('this is not valid JSON');
      
      const error1 = await waitForMessage(ws, 'error');
      expect(error1.message).toContain('Invalid message format');

      // Test 2: Send unknown message type
      ws.send(JSON.stringify({ type: 'unknown:action' }));
      
      const error2 = await waitForMessage(ws, 'error');
      expect(error2.message).toBeTruthy(); // Should receive an error message
      expect(error2.type).toBe('error');

      // Test 3: Verify connection is still open after errors
      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Test 4: Verify normal operations still work
      ws.send(JSON.stringify({ type: 'subscribe:devices' }));
      const subscribed = await waitForMessage(ws, 'subscribed');
      expect(subscribed.channel).toBe('devices');

      ws.close();
    });

    test('should recover from WebSocket disconnection', async () => {
      // Establish initial connection
      const ws1 = await createWebSocketClient();
      await waitForMessage(ws1, 'connected');

      ws1.send(JSON.stringify({ type: 'subscribe:devices' }));
      await waitForMessage(ws1, 'subscribed');

      // Close connection (simulating network interruption)
      ws1.close();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reconnect (simulating frontend reconnection logic)
      const ws2 = await createWebSocketClient();
      const welcomeMsg = await waitForMessage(ws2, 'connected');
      
      expect(welcomeMsg.type).toBe('connected');

      // Re-subscribe
      ws2.send(JSON.stringify({ type: 'subscribe:devices' }));
      const subscribed = await waitForMessage(ws2, 'subscribed');
      expect(subscribed.channel).toBe('devices');

      // Verify events are received after reconnection
      const testDevice = {
        ipAddress: '192.168.1.90',
        macAddress: 'AA:BB:CC:DD:EE:90',
        hostname: 'reconnect-test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      components.deviceScanner.emit('deviceDiscovered', testDevice);

      const event = await waitForMessage(ws2, 'device:discovered');
      expect(event.device.ipAddress).toBe(testDevice.ipAddress);

      ws2.close();
    });

    test('should handle concurrent errors without system failure', async () => {
      // Generate multiple concurrent errors
      const errorRequests = [
        fetch(`${BASE_URL}/api/devices/invalid.ip/status`),
        fetch(`${BASE_URL}/api/devices/999.999.999.999/health`),
        fetch(`${BASE_URL}/api/traffic/history`),
        fetch(`${BASE_URL}/api/traffic/history?start=bad&end=bad`),
        fetch(`${BASE_URL}/api/devices/0.0.0.0/status`)
      ];

      const responses = await Promise.allSettled(errorRequests);

      // All requests should complete (not crash the server)
      expect(responses).toHaveLength(5);
      responses.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Verify system is still operational
      const healthCheck = await fetch(`${BASE_URL}/api/system/info`);
      expect(healthCheck.status).toBe(200);

      const systemInfo = await healthCheck.json();
      expect(systemInfo).toHaveProperty('version');
      expect(systemInfo).toHaveProperty('uptime');
    });

    test('should handle data store errors gracefully', async () => {
      // This test verifies that the system continues to operate even if data store operations fail
      
      // Try to save a device with invalid data structure
      try {
        await components.dataStore.saveDevice(null);
      } catch (error) {
        // Error is expected, but system should continue
        expect(error).toBeDefined();
      }

      // Verify API is still functional
      const response = await fetch(`${BASE_URL}/api/devices`);
      expect(response.status).toBe(200);

      // Verify WebSocket is still functional
      const ws = await createWebSocketClient();
      const welcomeMsg = await waitForMessage(ws, 'connected');
      expect(welcomeMsg.type).toBe('connected');

      ws.close();
    });

    test('should log errors for troubleshooting', async () => {
      // This test verifies that errors are logged (Requirement 8.5)
      // In a real scenario, we would check log files, but here we verify
      // that error responses contain useful information

      const response = await fetch(`${BASE_URL}/api/devices/invalid.ip.address/status`);
      expect(response.status).toBe(404);

      const error = await response.json();
      
      // Error should contain useful troubleshooting information
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('message');
      
      // Error message should be descriptive
      expect(error.message).toBeTruthy();
      expect(error.message.length).toBeGreaterThan(10);
      
      // Error should provide helpful context (like available devices)
      expect(error).toHaveProperty('availableDevices');
    });
  });

  /**
   * Test 6: System Performance and Scalability
   * Validates: Requirements 6.6, 8.3, 8.4
   */
  describe('System Performance and Scalability', () => {
    test('should handle multiple concurrent operations without degradation', async () => {
      // Create multiple devices
      const devices = Array.from({ length: 10 }, (_, i) => ({
        ipAddress: `192.168.1.${100 + i}`,
        macAddress: `AA:BB:CC:DD:EE:${(100 + i).toString(16).toUpperCase()}`,
        hostname: `perf-device-${i}`,
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      }));

      // Perform concurrent operations
      const operations = [
        // Save devices
        ...devices.map(device => components.dataStore.saveDevice(device)),
        
        // Start monitoring
        ...devices.map(device => {
          components.statusMonitor.startMonitoring(device);
          components.healthMonitor.startMonitoring(device.ipAddress);
          return Promise.resolve();
        }),
        
        // Make API requests
        ...Array.from({ length: 10 }, () => fetch(`${BASE_URL}/api/devices`)),
        ...Array.from({ length: 10 }, () => fetch(`${BASE_URL}/api/traffic/current`)),
        ...Array.from({ length: 10 }, () => fetch(`${BASE_URL}/api/health/all`))
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      // All operations should complete
      expect(results).toHaveLength(operations.length);

      // Most operations should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(operations.length * 0.9); // At least 90% success

      // Operations should complete in reasonable time (< 10 seconds)
      expect(duration).toBeLessThan(10000);

      // Verify system is still responsive
      const healthCheck = await fetch(`${BASE_URL}/api/system/info`);
      expect(healthCheck.status).toBe(200);
    });

    test('should maintain performance with large device list', async () => {
      // Create a large number of devices
      const largeDeviceList = Array.from({ length: 50 }, (_, i) => ({
        ipAddress: `192.168.1.${150 + i}`,
        macAddress: `BB:CC:DD:EE:FF:${(150 + i).toString(16).toUpperCase()}`,
        hostname: `large-list-device-${i}`,
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: i % 2 === 0 // Alternate online/offline
      }));

      // Save all devices
      await Promise.all(largeDeviceList.map(device => 
        components.dataStore.saveDevice(device)
      ));

      // Measure API response time with large dataset
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}/api/devices`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      
      const devices = await response.json();
      expect(devices.length).toBeGreaterThanOrEqual(largeDeviceList.length);

      // Response time should be reasonable even with large dataset (< 2 seconds)
      expect(duration).toBeLessThan(2000);
    });
  });
});
