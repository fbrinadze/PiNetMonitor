/**
 * Property-Based Tests for API Endpoint Availability
 * Feature: network-monitor, Property 11: API Endpoint Availability
 */

const fc = require('fast-check');
const { createServer } = require('../../server/api/server');
const request = require('supertest');

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

describe('API Endpoint Availability Property Tests', () => {
  let server;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    const serverInstance = createServer({
      deviceScanner: mockDeviceScanner,
      statusMonitor: mockStatusMonitor,
      trafficAnalyzer: mockTrafficAnalyzer,
      healthMonitor: mockHealthMonitor,
      dataStore: mockDataStore
    }, { port: 3004 });

    server = serverInstance;
    app = serverInstance.app;
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  // Feature: network-monitor, Property 11: API Endpoint Availability
  describe('Property 11: API Endpoint Availability', () => {
    test('GET /api/devices endpoint is always available and returns 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random device arrays to test with different data
          fc.array(
            fc.record({
              ipAddress: fc.ipV4(),
              macAddress: fc.hexaString({ minLength: 12, maxLength: 12 }).map(s => {
                return s.match(/.{1,2}/g).join(':').toUpperCase();
              }),
              hostname: fc.string({ minLength: 1, maxLength: 20 }),
              vendor: fc.string({ minLength: 1, maxLength: 30 }),
              firstSeen: fc.date(),
              lastSeen: fc.date(),
              isActive: fc.boolean()
            }),
            { maxLength: 10 }
          ),
          async (devices) => {
            mockDataStore.getAllDevices.mockResolvedValue(devices);

            const response = await request(app).get('/api/devices');

            // Property: Endpoint must be available and return 200
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('POST /api/devices/scan endpoint is always available and returns 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input variation needed
          async () => {
            mockDeviceScanner.scanNetwork.mockResolvedValue([]);

            const response = await request(app)
              .post('/api/devices/scan')
              .send({});

            // Property: Endpoint must be available and return 200
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('estimatedTime');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/devices/:ip/status endpoint is available for any valid IP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          async (ipAddress) => {
            const mockStatus = {
              ipAddress,
              isOnline: true,
              lastChecked: new Date(),
              responseTime: 15.5
            };

            const statusMap = new Map();
            statusMap.set(ipAddress, mockStatus);
            mockStatusMonitor.getDeviceStatuses.mockReturnValue(statusMap);

            const response = await request(app).get(`/api/devices/${ipAddress}/status`);

            // Property: Endpoint must be available and return 200 for known devices
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('ipAddress');
            expect(response.body).toHaveProperty('isOnline');
            expect(response.body).toHaveProperty('lastChecked');
            expect(response.body).toHaveProperty('responseTime');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/devices/:ip/health endpoint is available for any valid IP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          async (ipAddress) => {
            const mockMetrics = {
              ipAddress,
              latency: 15.5,
              minLatency: 10.2,
              maxLatency: 25.8,
              packetLoss: 0.5,
              jitter: 3.2,
              lastUpdated: new Date(),
              isDegraded: false
            };

            mockHealthMonitor.getHealthMetrics.mockReturnValue(mockMetrics);

            const response = await request(app).get(`/api/devices/${ipAddress}/health`);

            // Property: Endpoint must be available and return 200 for known devices
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('ipAddress');
            expect(response.body).toHaveProperty('latency');
            expect(response.body).toHaveProperty('packetLoss');
            expect(response.body).toHaveProperty('isDegraded');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/traffic/current endpoint is always available and returns 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random traffic stats
          fc.record({
            timestamp: fc.date(),
            bytesReceived: fc.nat(),
            bytesSent: fc.nat(),
            bytesReceivedPerSec: fc.nat(),
            bytesSentPerSec: fc.nat(),
            packetsReceived: fc.nat(),
            packetsSent: fc.nat()
          }),
          async (stats) => {
            mockTrafficAnalyzer.getCurrentStats.mockReturnValue(stats);

            const response = await request(app).get('/api/traffic/current');

            // Property: Endpoint must be available and return 200
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('bytesReceived');
            expect(response.body).toHaveProperty('bytesSent');
            expect(response.body).toHaveProperty('bytesReceivedPerSec');
            expect(response.body).toHaveProperty('bytesSentPerSec');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/traffic/history endpoint is available with valid date parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date(),
          fc.date(),
          async (startDate, endDate) => {
            const mockHistory = [
              {
                timestamp: new Date(),
                bytesReceived: 1000,
                bytesSent: 500,
                bytesReceivedPerSec: 100,
                bytesSentPerSec: 50,
                packetsReceived: 10,
                packetsSent: 5
              }
            ];

            mockTrafficAnalyzer.getHistoricalStats.mockReturnValue(mockHistory);

            const response = await request(app)
              .get('/api/traffic/history')
              .query({
                start: startDate.toISOString(),
                end: endDate.toISOString()
              });

            // Property: Endpoint must be available and return 200 with valid dates
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/health/all endpoint is always available and returns 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random health metrics map
          fc.array(
            fc.record({
              ipAddress: fc.ipV4(),
              latency: fc.float({ min: 0, max: 1000 }),
              minLatency: fc.float({ min: 0, max: 500 }),
              maxLatency: fc.float({ min: 0, max: 1000 }),
              packetLoss: fc.float({ min: 0, max: 100 }),
              jitter: fc.float({ min: 0, max: 100 }),
              lastUpdated: fc.date(),
              isDegraded: fc.boolean()
            }),
            { maxLength: 10 }
          ),
          async (metricsArray) => {
            const metricsMap = new Map();
            metricsArray.forEach(m => metricsMap.set(m.ipAddress, m));
            mockHealthMonitor.getAllHealthMetrics.mockReturnValue(metricsMap);

            const response = await request(app).get('/api/health/all');

            // Property: Endpoint must be available and return 200
            expect(response.status).toBe(200);
            expect(typeof response.body).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/system/info endpoint is always available and returns 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input variation needed
          async () => {
            const response = await request(app).get('/api/system/info');

            // Property: Endpoint must be available and return 200
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('hostname');
            expect(response.body).toHaveProperty('platform');
            expect(response.body).toHaveProperty('arch');
            expect(response.body).toHaveProperty('nodeVersion');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('cpus');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('All required endpoints are accessible and return expected structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            // Setup mocks for all endpoints
            mockDataStore.getAllDevices.mockResolvedValue([]);
            mockDeviceScanner.scanNetwork.mockResolvedValue([]);
            mockStatusMonitor.getDeviceStatuses.mockReturnValue(new Map());
            mockHealthMonitor.getHealthMetrics.mockReturnValue(null);
            mockHealthMonitor.getAllHealthMetrics.mockReturnValue(new Map());
            mockTrafficAnalyzer.getCurrentStats.mockReturnValue({
              timestamp: new Date(),
              bytesReceived: 0,
              bytesSent: 0,
              bytesReceivedPerSec: 0,
              bytesSentPerSec: 0,
              packetsReceived: 0,
              packetsSent: 0
            });
            mockTrafficAnalyzer.getHistoricalStats.mockReturnValue([]);

            // Test all required endpoints
            const endpoints = [
              { method: 'get', path: '/api/devices' },
              { method: 'post', path: '/api/devices/scan' },
              { method: 'get', path: '/api/traffic/current' },
              { method: 'get', path: '/api/traffic/history?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z' },
              { method: 'get', path: '/api/health/all' },
              { method: 'get', path: '/api/system/info' }
            ];

            for (const endpoint of endpoints) {
              let response;
              if (endpoint.method === 'get') {
                response = await request(app).get(endpoint.path);
              } else if (endpoint.method === 'post') {
                response = await request(app).post(endpoint.path).send({});
              }

              // Property: All required endpoints must return 200
              expect(response.status).toBe(200);
              expect(response.headers['content-type']).toMatch(/application\/json/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
