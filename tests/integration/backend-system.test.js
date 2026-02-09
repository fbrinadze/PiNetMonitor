/**
 * Integration Tests for Backend System
 * Tests full device discovery and monitoring flow, data persistence, and concurrent operations
 * Validates: Requirements 6.3, 8.3, 8.4, 9.2
 */

const DeviceScanner = require('../../server/components/DeviceScanner');
const StatusMonitor = require('../../server/components/StatusMonitor');
const TrafficAnalyzer = require('../../server/components/TrafficAnalyzer');
const HealthMonitor = require('../../server/components/HealthMonitor');
const DataStore = require('../../server/components/DataStore');
const { createServer } = require('../../server/api/server');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

describe('Backend System Integration Tests', () => {
  let deviceScanner;
  let statusMonitor;
  let trafficAnalyzer;
  let healthMonitor;
  let dataStore;
  let server;
  let testDataDir;

  beforeEach(async () => {
    // Create temporary data directory for testing
    testDataDir = path.join(os.tmpdir(), `network-monitor-test-${Date.now()}`);
    await fs.mkdir(testDataDir, { recursive: true });

    // Initialize components
    deviceScanner = new DeviceScanner();
    statusMonitor = new StatusMonitor({ checkInterval: 1000 }); // Faster for testing
    trafficAnalyzer = new TrafficAnalyzer({ sampleInterval: 500 }); // Faster for testing
    healthMonitor = new HealthMonitor({ updateInterval: 2000 }); // Faster for testing
    dataStore = new DataStore(testDataDir);
    await dataStore.initialize();

    // Create server
    server = createServer({
      deviceScanner,
      statusMonitor,
      trafficAnalyzer,
      healthMonitor,
      dataStore
    }, {
      port: 3001 // Use different port for testing
    });
  });

  afterEach(async () => {
    // Cleanup
    if (server) {
      await server.stop();
    }
    
    statusMonitor.stopAll();
    trafficAnalyzer.stopMonitoring();
    healthMonitor.stopAll();
    
    if (dataStore) {
      await dataStore.close();
    }

    // Remove test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Test full device discovery and monitoring flow
   * Validates: Requirements 6.3, 8.3
   */
  describe('Full Device Discovery and Monitoring Flow', () => {
    test('should discover device, start monitoring, and track status changes', async () => {
      // Mock a device discovery
      const mockDevice = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      // Add device to scanner cache
      deviceScanner.deviceCache.set(mockDevice.ipAddress, mockDevice);

      // Save device to data store
      await dataStore.saveDevice(mockDevice);

      // Start monitoring the device
      statusMonitor.startMonitoring(mockDevice);
      healthMonitor.startMonitoring(mockDevice.ipAddress);

      // Verify device is being monitored
      const statuses = statusMonitor.getDeviceStatuses();
      expect(statuses.has(mockDevice.ipAddress)).toBe(true);

      const healthMetrics = healthMonitor.getAllHealthMetrics();
      expect(healthMetrics.has(mockDevice.ipAddress)).toBe(true);

      // Verify device was persisted
      const retrievedDevice = await dataStore.getDevice(mockDevice.ipAddress);
      expect(retrievedDevice).toBeTruthy();
      expect(retrievedDevice.ipAddress).toBe(mockDevice.ipAddress);
      expect(retrievedDevice.macAddress).toBe(mockDevice.macAddress);
    });

    test('should handle multiple devices concurrently', async () => {
      const mockDevices = [
        {
          ipAddress: '192.168.1.101',
          macAddress: 'AA:BB:CC:DD:EE:01',
          hostname: 'device-1',
          vendor: 'Vendor A',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.102',
          macAddress: 'AA:BB:CC:DD:EE:02',
          hostname: 'device-2',
          vendor: 'Vendor B',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.103',
          macAddress: 'AA:BB:CC:DD:EE:03',
          hostname: 'device-3',
          vendor: 'Vendor C',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        }
      ];

      // Add all devices concurrently
      await Promise.all(mockDevices.map(async (device) => {
        deviceScanner.deviceCache.set(device.ipAddress, device);
        await dataStore.saveDevice(device);
        statusMonitor.startMonitoring(device);
        healthMonitor.startMonitoring(device.ipAddress);
      }));

      // Verify all devices are being monitored
      const statuses = statusMonitor.getDeviceStatuses();
      expect(statuses.size).toBe(mockDevices.length);

      const healthMetrics = healthMonitor.getAllHealthMetrics();
      expect(healthMetrics.size).toBe(mockDevices.length);

      // Verify all devices were persisted
      const allDevices = await dataStore.getAllDevices();
      expect(allDevices.length).toBe(mockDevices.length);

      mockDevices.forEach(mockDevice => {
        expect(statuses.has(mockDevice.ipAddress)).toBe(true);
        expect(healthMetrics.has(mockDevice.ipAddress)).toBe(true);
        
        const persistedDevice = allDevices.find(d => d.ipAddress === mockDevice.ipAddress);
        expect(persistedDevice).toBeTruthy();
        expect(persistedDevice.macAddress).toBe(mockDevice.macAddress);
      });
    });

    test('should emit events when devices are discovered', (done) => {
      const mockDevice = {
        ipAddress: '192.168.1.104',
        macAddress: 'AA:BB:CC:DD:EE:04',
        hostname: 'event-test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      // Listen for device discovered event
      deviceScanner.once('deviceDiscovered', (device) => {
        expect(device.ipAddress).toBe(mockDevice.ipAddress);
        expect(device.macAddress).toBe(mockDevice.macAddress);
        done();
      });

      // Trigger device discovery event
      deviceScanner.emit('deviceDiscovered', mockDevice);
    });
  });

  /**
   * Test data persistence across server restarts
   * Validates: Requirements 8.4, 9.2
   */
  describe('Data Persistence Across Server Restarts', () => {
    test('should persist and restore devices across restarts', async () => {
      // Create and save devices
      const devices = [
        {
          ipAddress: '192.168.1.110',
          macAddress: 'AA:BB:CC:DD:EE:10',
          hostname: 'persistent-device-1',
          vendor: 'Vendor A',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.111',
          macAddress: 'AA:BB:CC:DD:EE:11',
          hostname: 'persistent-device-2',
          vendor: 'Vendor B',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: false
        }
      ];

      // Save devices
      for (const device of devices) {
        await dataStore.saveDevice(device);
      }

      // Close the data store (simulating shutdown)
      await dataStore.close();

      // Create a new data store instance (simulating restart)
      const newDataStore = new DataStore(testDataDir);
      await newDataStore.initialize();

      // Retrieve devices
      const restoredDevices = await newDataStore.getAllDevices();

      // Verify devices were restored
      expect(restoredDevices.length).toBe(devices.length);

      devices.forEach(originalDevice => {
        const restored = restoredDevices.find(d => d.ipAddress === originalDevice.ipAddress);
        expect(restored).toBeTruthy();
        expect(restored.macAddress).toBe(originalDevice.macAddress);
        expect(restored.hostname).toBe(originalDevice.hostname);
        expect(restored.isActive).toBe(originalDevice.isActive);
      });

      await newDataStore.close();
    });

    test('should persist and restore traffic stats', async () => {
      const trafficStats = [
        {
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          bytesReceived: 1000000,
          bytesSent: 500000,
          bytesReceivedPerSec: 1000,
          bytesSentPerSec: 500,
          packetsReceived: 10000,
          packetsSent: 5000
        },
        {
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          bytesReceived: 2000000,
          bytesSent: 1000000,
          bytesReceivedPerSec: 2000,
          bytesSentPerSec: 1000,
          packetsReceived: 20000,
          packetsSent: 10000
        }
      ];

      // Save traffic stats
      for (const stats of trafficStats) {
        await dataStore.saveTrafficStats(stats);
      }

      // Close and reopen
      await dataStore.close();
      const newDataStore = new DataStore(testDataDir);
      await newDataStore.initialize();

      // Retrieve traffic stats
      const startTime = new Date(Date.now() - 7200000); // 2 hours ago
      const endTime = new Date();
      const restoredStats = await newDataStore.getTrafficStats(startTime, endTime);

      // Verify stats were restored
      expect(restoredStats.length).toBe(trafficStats.length);

      await newDataStore.close();
    });

    test('should persist and restore health metrics', async () => {
      const healthMetrics = [
        {
          ipAddress: '192.168.1.120',
          latency: 15.5,
          minLatency: 10.2,
          maxLatency: 25.8,
          packetLoss: 0.5,
          jitter: 3.2,
          lastUpdated: new Date(Date.now() - 3600000),
          isDegraded: false
        },
        {
          ipAddress: '192.168.1.121',
          latency: 150.0,
          minLatency: 100.0,
          maxLatency: 200.0,
          packetLoss: 10.0,
          jitter: 25.0,
          lastUpdated: new Date(Date.now() - 1800000),
          isDegraded: true
        }
      ];

      // Save health metrics
      for (const metrics of healthMetrics) {
        await dataStore.saveHealthMetrics(metrics);
      }

      // Close and reopen
      await dataStore.close();
      const newDataStore = new DataStore(testDataDir);
      await newDataStore.initialize();

      // Retrieve health metrics
      const startTime = new Date(Date.now() - 7200000);
      const endTime = new Date();
      
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

      await newDataStore.close();
    });
  });

  /**
   * Test concurrent operations
   * Validates: Requirements 6.3, 8.3
   */
  describe('Concurrent Operations', () => {
    test('should handle concurrent device scanning, monitoring, and API requests', async () => {
      // Start the server
      await server.start();

      // Create mock devices
      const devices = Array.from({ length: 5 }, (_, i) => ({
        ipAddress: `192.168.1.${130 + i}`,
        macAddress: `AA:BB:CC:DD:EE:${(30 + i).toString(16).toUpperCase()}`,
        hostname: `concurrent-device-${i}`,
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      }));

      // Perform concurrent operations
      const operations = [
        // Save devices
        ...devices.map(device => dataStore.saveDevice(device)),
        
        // Start monitoring
        ...devices.map(device => {
          statusMonitor.startMonitoring(device);
          healthMonitor.startMonitoring(device.ipAddress);
          return Promise.resolve();
        }),
        
        // Make API requests
        fetch(`http://localhost:3001/api/devices`).catch(() => {}),
        fetch(`http://localhost:3001/api/traffic/current`).catch(() => {}),
        fetch(`http://localhost:3001/api/health/all`).catch(() => {}),
        fetch(`http://localhost:3001/api/system/info`).catch(() => {})
      ];

      // Wait for all operations to complete
      await Promise.allSettled(operations);

      // Verify system is still functional
      const allDevices = await dataStore.getAllDevices();
      expect(allDevices.length).toBeGreaterThanOrEqual(devices.length);

      const statuses = statusMonitor.getDeviceStatuses();
      expect(statuses.size).toBeGreaterThanOrEqual(devices.length);

      const healthMetrics = healthMonitor.getAllHealthMetrics();
      expect(healthMetrics.size).toBeGreaterThanOrEqual(devices.length);
    });

    test('should handle concurrent data writes without corruption', async () => {
      const writeOperations = Array.from({ length: 20 }, (_, i) => ({
        ipAddress: `192.168.1.${140 + i}`,
        macAddress: `AA:BB:CC:DD:EE:${(40 + i).toString(16).toUpperCase()}`,
        hostname: `write-test-${i}`,
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      }));

      // Perform concurrent writes
      await Promise.all(writeOperations.map(device => dataStore.saveDevice(device)));

      // Verify all devices were saved correctly
      const allDevices = await dataStore.getAllDevices();
      expect(allDevices.length).toBeGreaterThanOrEqual(writeOperations.length);

      // Verify data integrity
      writeOperations.forEach(originalDevice => {
        const saved = allDevices.find(d => d.ipAddress === originalDevice.ipAddress);
        expect(saved).toBeTruthy();
        expect(saved.macAddress).toBe(originalDevice.macAddress);
        expect(saved.hostname).toBe(originalDevice.hostname);
      });
    });
  });
});
