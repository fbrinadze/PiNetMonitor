/**
 * Property-Based Tests for API Response JSON Format
 * Feature: network-monitor, Property 10: API Response JSON Format
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

describe('API Response JSON Format Property Tests', () => {
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
    }, { port: 3003 });

    server = serverInstance;
    app = serverInstance.app;
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  // Feature: network-monitor, Property 10: API Response JSON Format
  describe('Property 10: API Response JSON Format', () => {
    test('GET /api/devices returns valid JSON for any device list', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random array of devices
          fc.array(
            fc.record({
              ipAddress: fc.ipV4(),
              macAddress: fc.hexaString({ minLength: 12, maxLength: 12 }).map(s => {
                return s.match(/.{1,2}/g).join(':').toUpperCase();
              }),
              hostname: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.constant('unknown')
              ),
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

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(Array.isArray(response.body)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('POST /api/devices/scan returns valid JSON for any subnet', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random subnet
          fc.oneof(
            fc.constant('192.168.1'),
            fc.constant('10.0.0'),
            fc.constant('172.16.0')
          ),
          async (subnet) => {
            mockDeviceScanner.scanNetwork.mockResolvedValue([]);

            const response = await request(app)
              .post('/api/devices/scan')
              .send({ subnet });

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('estimatedTime');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/devices/:ip/status returns valid JSON for any device status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random device status
          fc.record({
            ipAddress: fc.ipV4(),
            isOnline: fc.boolean(),
            lastChecked: fc.date(),
            responseTime: fc.oneof(
              fc.float({ min: 0, max: 1000 }),
              fc.constant(-1)
            )
          }),
          async (status) => {
            const statusMap = new Map();
            statusMap.set(status.ipAddress, status);
            mockStatusMonitor.getDeviceStatuses.mockReturnValue(statusMap);

            const response = await request(app).get(`/api/devices/${status.ipAddress}/status`);

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('ipAddress');
            expect(response.body).toHaveProperty('isOnline');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/devices/:ip/health returns valid JSON for any health metrics', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random health metrics
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
          async (metrics) => {
            mockHealthMonitor.getHealthMetrics.mockReturnValue(metrics);

            const response = await request(app).get(`/api/devices/${metrics.ipAddress}/health`);

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('ipAddress');
            expect(response.body).toHaveProperty('latency');
            expect(response.body).toHaveProperty('packetLoss');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/traffic/current returns valid JSON for any traffic stats', async () => {
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

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('bytesReceived');
            expect(response.body).toHaveProperty('bytesSent');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/traffic/history returns valid JSON for any time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random historical data
          fc.array(
            fc.record({
              timestamp: fc.date(),
              bytesReceived: fc.nat(),
              bytesSent: fc.nat(),
              bytesReceivedPerSec: fc.nat(),
              bytesSentPerSec: fc.nat(),
              packetsReceived: fc.nat(),
              packetsSent: fc.nat()
            }),
            { maxLength: 20 }
          ),
          fc.date(),
          fc.date(),
          async (history, startDate, endDate) => {
            mockTrafficAnalyzer.getHistoricalStats.mockReturnValue(history);

            const response = await request(app)
              .get('/api/traffic/history')
              .query({
                start: startDate.toISOString(),
                end: endDate.toISOString()
              });

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(Array.isArray(response.body)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/health/all returns valid JSON for any health metrics map', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random map of health metrics
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

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(typeof response.body).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GET /api/system/info returns valid JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed for system info
          async () => {
            const response = await request(app).get('/api/system/info');

            // Property: Response must be valid JSON
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('hostname');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('404 errors return valid JSON for any invalid route', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random invalid routes
          fc.oneof(
            fc.constant('/api/invalid'),
            fc.constant('/api/devices/invalid/route'),
            fc.constant('/api/nonexistent')
          ),
          async (route) => {
            const response = await request(app).get(route);

            // Property: Error response must be valid JSON
            expect(response.status).toBe(404);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('400 errors return valid JSON for invalid query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random invalid date strings
          fc.oneof(
            fc.constant('invalid-date'),
            fc.constant('not-a-timestamp'),
            fc.constant('2024-99-99')
          ),
          async (invalidDate) => {
            const response = await request(app)
              .get('/api/traffic/history')
              .query({
                start: invalidDate,
                end: '2024-01-15T23:59:59Z'
              });

            // Property: Error response must be valid JSON
            expect(response.status).toBe(400);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('500 errors return valid JSON for server errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 50 }),
          async (errorMessage) => {
            mockDataStore.getAllDevices.mockRejectedValue(new Error(errorMessage));

            const response = await request(app).get('/api/devices');

            // Property: Error response must be valid JSON
            expect(response.status).toBe(500);
            expect(response.headers['content-type']).toMatch(/application\/json/);
            expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('timestamp');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
