const DataStore = require('../../server/components/DataStore');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('DataStore', () => {
  let dataStore;
  let testDir;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `network-monitor-test-${Date.now()}`);
    dataStore = new DataStore(testDir);
    await dataStore.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    await dataStore.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Device CRUD Operations', () => {
    test('should save a new device', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };

      await dataStore.saveDevice(device);
      const retrieved = await dataStore.getDevice('192.168.1.100');

      expect(retrieved).toMatchObject({
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        hostname: device.hostname,
        vendor: device.vendor,
        isActive: device.isActive
      });
    });

    test('should update an existing device', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        isActive: true
      };

      await dataStore.saveDevice(device);
      
      // Update the device
      const updatedDevice = {
        ...device,
        hostname: 'updated-device',
        isActive: false
      };
      await dataStore.saveDevice(updatedDevice);

      const retrieved = await dataStore.getDevice('192.168.1.100');
      expect(retrieved.hostname).toBe('updated-device');
      expect(retrieved.isActive).toBe(false);
    });

    test('should get all devices', async () => {
      const devices = [
        { ipAddress: '192.168.1.100', macAddress: 'AA:BB:CC:DD:EE:FF', hostname: 'device1', isActive: true },
        { ipAddress: '192.168.1.101', macAddress: 'AA:BB:CC:DD:EE:00', hostname: 'device2', isActive: true },
        { ipAddress: '192.168.1.102', macAddress: 'AA:BB:CC:DD:EE:01', hostname: 'device3', isActive: false }
      ];

      for (const device of devices) {
        await dataStore.saveDevice(device);
      }

      const allDevices = await dataStore.getAllDevices();
      expect(allDevices).toHaveLength(3);
      expect(allDevices.map(d => d.ipAddress)).toEqual(
        expect.arrayContaining(['192.168.1.100', '192.168.1.101', '192.168.1.102'])
      );
    });

    test('should delete a device', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        isActive: true
      };

      await dataStore.saveDevice(device);
      expect(await dataStore.getDevice('192.168.1.100')).not.toBeNull();

      await dataStore.deleteDevice('192.168.1.100');
      expect(await dataStore.getDevice('192.168.1.100')).toBeNull();
    });

    test('should return null for non-existent device', async () => {
      const device = await dataStore.getDevice('192.168.1.999');
      expect(device).toBeNull();
    });
  });

  describe('Traffic Stats Operations', () => {
    test('should save traffic statistics', async () => {
      const stats = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        bytesReceived: 1000000,
        bytesSent: 500000,
        bytesReceivedPerSec: 10000,
        bytesSentPerSec: 5000,
        packetsReceived: 1000,
        packetsSent: 500
      };

      await dataStore.saveTrafficStats(stats);
      
      const startTime = new Date('2024-01-15T09:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');
      const retrieved = await dataStore.getTrafficStats(startTime, endTime);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toMatchObject({
        bytesReceived: stats.bytesReceived,
        bytesSent: stats.bytesSent,
        bytesReceivedPerSec: stats.bytesReceivedPerSec,
        bytesSentPerSec: stats.bytesSentPerSec
      });
    });

    test('should retrieve traffic stats within time range', async () => {
      const stats = [
        { timestamp: new Date('2024-01-15T10:00:00Z'), bytesReceived: 1000, bytesSent: 500 },
        { timestamp: new Date('2024-01-15T11:00:00Z'), bytesReceived: 2000, bytesSent: 1000 },
        { timestamp: new Date('2024-01-15T12:00:00Z'), bytesReceived: 3000, bytesSent: 1500 }
      ];

      for (const stat of stats) {
        await dataStore.saveTrafficStats(stat);
      }

      const startTime = new Date('2024-01-15T10:30:00Z');
      const endTime = new Date('2024-01-15T12:30:00Z');
      const retrieved = await dataStore.getTrafficStats(startTime, endTime);

      expect(retrieved).toHaveLength(2);
      expect(retrieved.map(s => s.bytesReceived)).toEqual([2000, 3000]);
    });

    test('should return empty array when no stats in range', async () => {
      const stats = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        bytesReceived: 1000,
        bytesSent: 500
      };

      await dataStore.saveTrafficStats(stats);

      const startTime = new Date('2024-01-16T10:00:00Z');
      const endTime = new Date('2024-01-16T11:00:00Z');
      const retrieved = await dataStore.getTrafficStats(startTime, endTime);

      expect(retrieved).toHaveLength(0);
    });
  });

  describe('Health Metrics Operations', () => {
    test('should save health metrics', async () => {
      const metrics = {
        ipAddress: '192.168.1.100',
        latency: 15.5,
        minLatency: 10.2,
        maxLatency: 25.8,
        packetLoss: 0.5,
        jitter: 3.2,
        lastUpdated: new Date('2024-01-15T10:00:00Z'),
        isDegraded: false
      };

      await dataStore.saveHealthMetrics(metrics);

      const startTime = new Date('2024-01-15T09:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');
      const retrieved = await dataStore.getHealthMetrics('192.168.1.100', startTime, endTime);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toMatchObject({
        ipAddress: metrics.ipAddress,
        latency: metrics.latency,
        packetLoss: metrics.packetLoss,
        isDegraded: metrics.isDegraded
      });
    });

    test('should retrieve health metrics for specific device within time range', async () => {
      const metrics = [
        { ipAddress: '192.168.1.100', latency: 10, lastUpdated: new Date('2024-01-15T10:00:00Z') },
        { ipAddress: '192.168.1.100', latency: 15, lastUpdated: new Date('2024-01-15T11:00:00Z') },
        { ipAddress: '192.168.1.101', latency: 20, lastUpdated: new Date('2024-01-15T10:30:00Z') }
      ];

      for (const metric of metrics) {
        await dataStore.saveHealthMetrics(metric);
      }

      const startTime = new Date('2024-01-15T09:00:00Z');
      const endTime = new Date('2024-01-15T12:00:00Z');
      const retrieved = await dataStore.getHealthMetrics('192.168.1.100', startTime, endTime);

      expect(retrieved).toHaveLength(2);
      expect(retrieved.map(m => m.latency)).toEqual([10, 15]);
    });

    test('should filter by IP address correctly', async () => {
      const metrics = [
        { ipAddress: '192.168.1.100', latency: 10, lastUpdated: new Date('2024-01-15T10:00:00Z') },
        { ipAddress: '192.168.1.101', latency: 20, lastUpdated: new Date('2024-01-15T10:00:00Z') }
      ];

      for (const metric of metrics) {
        await dataStore.saveHealthMetrics(metric);
      }

      const startTime = new Date('2024-01-15T09:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');
      const retrieved = await dataStore.getHealthMetrics('192.168.1.101', startTime, endTime);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].ipAddress).toBe('192.168.1.101');
    });
  });

  describe('Cleanup Operations', () => {
    test('should remove old traffic stats', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const stats = [
        { timestamp: new Date('2024-01-14T10:00:00Z'), bytesReceived: 1000 }, // 26 hours old
        { timestamp: new Date('2024-01-15T10:00:00Z'), bytesReceived: 2000 }, // 2 hours old
        { timestamp: new Date('2024-01-15T11:00:00Z'), bytesReceived: 3000 }  // 1 hour old
      ];

      for (const stat of stats) {
        await dataStore.saveTrafficStats(stat);
      }

      const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      await dataStore.cleanupOldData(threshold);

      const allStats = await dataStore.getTrafficStats(
        new Date('2024-01-14T00:00:00Z'),
        new Date('2024-01-15T23:59:59Z')
      );

      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.bytesReceived)).toEqual([2000, 3000]);
    });

    test('should remove old health metrics', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const metrics = [
        { ipAddress: '192.168.1.100', latency: 10, lastUpdated: new Date('2024-01-14T10:00:00Z') }, // 26 hours old
        { ipAddress: '192.168.1.100', latency: 15, lastUpdated: new Date('2024-01-15T10:00:00Z') }, // 2 hours old
        { ipAddress: '192.168.1.100', latency: 20, lastUpdated: new Date('2024-01-15T11:00:00Z') }  // 1 hour old
      ];

      for (const metric of metrics) {
        await dataStore.saveHealthMetrics(metric);
      }

      const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      await dataStore.cleanupOldData(threshold);

      const allMetrics = await dataStore.getHealthMetrics(
        '192.168.1.100',
        new Date('2024-01-14T00:00:00Z'),
        new Date('2024-01-15T23:59:59Z')
      );

      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.latency)).toEqual([15, 20]);
    });

    test('should not remove recent data', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const stats = [
        { timestamp: new Date('2024-01-15T10:00:00Z'), bytesReceived: 1000 },
        { timestamp: new Date('2024-01-15T11:00:00Z'), bytesReceived: 2000 }
      ];

      for (const stat of stats) {
        await dataStore.saveTrafficStats(stat);
      }

      const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await dataStore.cleanupOldData(threshold);

      const allStats = await dataStore.getTrafficStats(
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-01-15T23:59:59Z')
      );

      expect(allStats).toHaveLength(2);
    });
  });

  describe('Data Persistence', () => {
    test('should persist data across restarts', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        isActive: true
      };

      await dataStore.saveDevice(device);
      await dataStore.close();

      // Create new instance with same directory
      const newDataStore = new DataStore(testDir);
      await newDataStore.initialize();

      const retrieved = await newDataStore.getDevice('192.168.1.100');
      expect(retrieved).toMatchObject({
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        hostname: device.hostname
      });

      await newDataStore.close();
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted data gracefully', async () => {
      // Write invalid JSON to the database file
      const dbPath = path.join(testDir, 'db.json');
      await fs.writeFile(dbPath, 'invalid json{{{');

      // Create new instance - should handle corrupted data gracefully
      const newDataStore = new DataStore(testDir);
      
      // Should initialize successfully with empty data
      await newDataStore.initialize();
      const devices = await newDataStore.getAllDevices();
      
      expect(devices).toEqual([]);
      
      await newDataStore.close();
    });

    test('should initialize with empty data if file does not exist', async () => {
      const newDir = path.join(os.tmpdir(), `network-monitor-test-new-${Date.now()}`);
      const newDataStore = new DataStore(newDir);
      
      await newDataStore.initialize();
      const devices = await newDataStore.getAllDevices();
      
      expect(devices).toEqual([]);
      
      await newDataStore.close();
      await fs.rm(newDir, { recursive: true, force: true });
    });
  });
});
