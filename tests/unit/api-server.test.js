/**
 * Unit tests for REST API Server
 */

const { createServer } = require('../../server/api/server');

// Mock components
const mockDeviceScanner = {
  scanNetwork: jest.fn(),
  getCachedDevices: jest.fn()
};

const mockStatusMonitor = {
  getDeviceStatuses: jest.fn(),
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn()
};

const mockTrafficAnalyzer = {
  getCurrentStats: jest.fn(),
  getHistoricalStats: jest.fn()
};

const mockHealthMonitor = {
  getHealthMetrics: jest.fn(),
  getAllHealthMetrics: jest.fn()
};

const mockDataStore = {
  getAllDevices: jest.fn(),
  getDevice: jest.fn(),
  saveDevice: jest.fn()
};

describe('REST API Server', () => {
  let server;
  let app;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create server instance
    const serverInstance = createServer({
      deviceScanner: mockDeviceScanner,
      statusMonitor: mockStatusMonitor,
      trafficAnalyzer: mockTrafficAnalyzer,
      healthMonitor: mockHealthMonitor,
      dataStore: mockDataStore
    }, { port: 3001 });

    server = serverInstance;
    app = serverInstance.app;
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('GET /api/devices', () => {
    test('should return all devices', async () => {
      const mockDevices = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          hostname: 'test-device',
          vendor: 'Apple',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        }
      ];

      mockDataStore.getAllDevices.mockResolvedValue(mockDevices);

      const request = require('supertest');
      const response = await request(app).get('/api/devices');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].ipAddress).toBe('192.168.1.100');
      expect(response.body[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(response.body[0].hostname).toBe('test-device');
      expect(mockDataStore.getAllDevices).toHaveBeenCalledTimes(1);
    });

    test('should return empty array when no devices', async () => {
      mockDataStore.getAllDevices.mockResolvedValue([]);

      const request = require('supertest');
      const response = await request(app).get('/api/devices');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/devices/scan', () => {
    test('should trigger network scan and return status', async () => {
      mockDeviceScanner.scanNetwork.mockResolvedValue([]);

      const request = require('supertest');
      const response = await request(app)
        .post('/api/devices/scan')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'started');
      expect(response.body).toHaveProperty('estimatedTime');
      expect(typeof response.body.estimatedTime).toBe('number');
    });

    test('should accept custom subnet', async () => {
      mockDeviceScanner.scanNetwork.mockResolvedValue([]);

      const request = require('supertest');
      const response = await request(app)
        .post('/api/devices/scan')
        .send({ subnet: '10.0.0' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('started');
    });
  });

  describe('GET /api/devices/:ip/status', () => {
    test('should return device status', async () => {
      const mockStatus = {
        ipAddress: '192.168.1.100',
        isOnline: true,
        lastChecked: new Date(),
        responseTime: 15.5
      };

      const statusMap = new Map();
      statusMap.set('192.168.1.100', mockStatus);
      mockStatusMonitor.getDeviceStatuses.mockReturnValue(statusMap);

      const request = require('supertest');
      const response = await request(app).get('/api/devices/192.168.1.100/status');

      expect(response.status).toBe(200);
      expect(response.body.ipAddress).toBe('192.168.1.100');
      expect(response.body.isOnline).toBe(true);
      expect(response.body.responseTime).toBe(15.5);
    });

    test('should return 404 for unknown device', async () => {
      const statusMap = new Map();
      statusMap.set('192.168.1.100', {});
      mockStatusMonitor.getDeviceStatuses.mockReturnValue(statusMap);

      const request = require('supertest');
      const response = await request(app).get('/api/devices/192.168.1.200/status');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Device not found');
      expect(response.body).toHaveProperty('availableDevices');
    });
  });

  describe('GET /api/devices/:ip/health', () => {
    test('should return device health metrics', async () => {
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

      mockHealthMonitor.getHealthMetrics.mockReturnValue(mockMetrics);

      const request = require('supertest');
      const response = await request(app).get('/api/devices/192.168.1.100/health');

      expect(response.status).toBe(200);
      expect(response.body.ipAddress).toBe('192.168.1.100');
      expect(response.body.latency).toBe(15.5);
      expect(response.body.packetLoss).toBe(0.5);
      expect(response.body.isDegraded).toBe(false);
    });

    test('should return 404 for unknown device', async () => {
      mockHealthMonitor.getHealthMetrics.mockReturnValue(undefined);
      mockHealthMonitor.getAllHealthMetrics.mockReturnValue(new Map());

      const request = require('supertest');
      const response = await request(app).get('/api/devices/192.168.1.200/health');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Device not found');
    });
  });

  describe('GET /api/traffic/current', () => {
    test('should return current traffic stats', async () => {
      const mockStats = {
        timestamp: new Date(),
        bytesReceived: 1048576,
        bytesSent: 524288,
        bytesReceivedPerSec: 125000,
        bytesSentPerSec: 62500,
        packetsReceived: 1000,
        packetsSent: 500
      };

      mockTrafficAnalyzer.getCurrentStats.mockReturnValue(mockStats);

      const request = require('supertest');
      const response = await request(app).get('/api/traffic/current');

      expect(response.status).toBe(200);
      expect(response.body.bytesReceived).toBe(1048576);
      expect(response.body.bytesSent).toBe(524288);
      expect(response.body.bytesReceivedPerSec).toBe(125000);
      expect(response.body.bytesSentPerSec).toBe(62500);
    });

    test('should return default stats when not initialized', async () => {
      mockTrafficAnalyzer.getCurrentStats.mockReturnValue(null);

      const request = require('supertest');
      const response = await request(app).get('/api/traffic/current');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bytesReceived', 0);
      expect(response.body).toHaveProperty('bytesSent', 0);
    });
  });

  describe('GET /api/traffic/history', () => {
    test('should return historical traffic data', async () => {
      const mockHistory = [
        {
          timestamp: new Date('2024-01-15T10:00:00Z'),
          bytesReceived: 1000,
          bytesSent: 500,
          bytesReceivedPerSec: 100,
          bytesSentPerSec: 50,
          packetsReceived: 10,
          packetsSent: 5
        }
      ];

      mockTrafficAnalyzer.getHistoricalStats.mockReturnValue(mockHistory);

      const request = require('supertest');
      const response = await request(app)
        .get('/api/traffic/history')
        .query({
          start: '2024-01-15T00:00:00Z',
          end: '2024-01-15T23:59:59Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].bytesReceived).toBe(1000);
      expect(response.body[0].bytesSent).toBe(500);
      expect(mockTrafficAnalyzer.getHistoricalStats).toHaveBeenCalled();
    });

    test('should return 400 when start parameter is missing', async () => {
      const request = require('supertest');
      const response = await request(app)
        .get('/api/traffic/history')
        .query({ end: '2024-01-15T23:59:59Z' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    test('should return 400 when end parameter is missing', async () => {
      const request = require('supertest');
      const response = await request(app)
        .get('/api/traffic/history')
        .query({ start: '2024-01-15T00:00:00Z' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
    });

    test('should return 400 for invalid date format', async () => {
      const request = require('supertest');
      const response = await request(app)
        .get('/api/traffic/history')
        .query({
          start: 'invalid-date',
          end: '2024-01-15T23:59:59Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Invalid date format');
    });
  });

  describe('GET /api/health/all', () => {
    test('should return all health metrics', async () => {
      const metricsMap = new Map();
      metricsMap.set('192.168.1.100', {
        ipAddress: '192.168.1.100',
        latency: 15.5,
        minLatency: 10.2,
        maxLatency: 25.8,
        packetLoss: 0.5,
        jitter: 3.2,
        lastUpdated: new Date(),
        isDegraded: false
      });

      mockHealthMonitor.getAllHealthMetrics.mockReturnValue(metricsMap);

      const request = require('supertest');
      const response = await request(app).get('/api/health/all');

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
      expect(response.body['192.168.1.100']).toBeDefined();
      expect(response.body['192.168.1.100'].ipAddress).toBe('192.168.1.100');
    });

    test('should return empty object when no metrics', async () => {
      mockHealthMonitor.getAllHealthMetrics.mockReturnValue(new Map());

      const request = require('supertest');
      const response = await request(app).get('/api/health/all');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });
  });

  describe('GET /api/system/info', () => {
    test('should return system information', async () => {
      const request = require('supertest');
      const response = await request(app).get('/api/system/info');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('hostname');
      expect(response.body).toHaveProperty('platform');
      expect(response.body).toHaveProperty('arch');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpus');
    });
  });

  describe('Error handling', () => {
    test('should return 404 for undefined routes', async () => {
      const request = require('supertest');
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('availableEndpoints');
    });

    test('should handle server errors', async () => {
      mockDataStore.getAllDevices.mockRejectedValue(new Error('Database error'));

      const request = require('supertest');
      const response = await request(app).get('/api/devices');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Server lifecycle', () => {
    test('should start and stop server', async () => {
      const testServer = createServer({
        deviceScanner: mockDeviceScanner,
        statusMonitor: mockStatusMonitor,
        trafficAnalyzer: mockTrafficAnalyzer,
        healthMonitor: mockHealthMonitor,
        dataStore: mockDataStore
      }, { port: 3002 });

      await testServer.start();
      await testServer.stop();
    });
  });
});
