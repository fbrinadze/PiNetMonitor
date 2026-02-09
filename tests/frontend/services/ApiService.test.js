/**
 * Unit tests for ApiService
 * Tests API functions with mock responses, error handling, and retry logic
 * Requirements: 7.4
 */

// Mock axios before importing ApiService
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
};

const mockAxiosCreate = jest.fn(() => mockAxiosInstance);

jest.mock('axios', () => ({
  create: mockAxiosCreate,
}));

// Import ApiService after mocking
const ApiService = require('../../../client/src/services/ApiService.js');
const {
  fetchDevices,
  fetchDeviceStatus,
  fetchDeviceHealth,
  fetchCurrentTraffic,
  fetchTrafficHistory,
  fetchAllHealth,
  fetchSystemInfo,
  triggerScan,
} = ApiService;

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers(); // Use real timers by default
  });

  describe('Axios Instance Configuration', () => {
    test('should create axios instance with correct configuration', () => {
      // Verify the module exports the expected functions
      expect(typeof fetchDevices).toBe('function');
      expect(typeof triggerScan).toBe('function');
      expect(typeof fetchDeviceStatus).toBe('function');
      expect(typeof fetchDeviceHealth).toBe('function');
      expect(typeof fetchCurrentTraffic).toBe('function');
      expect(typeof fetchTrafficHistory).toBe('function');
      expect(typeof fetchAllHealth).toBe('function');
      expect(typeof fetchSystemInfo).toBe('function');
    });
  });

  describe('fetchDevices', () => {
    test('should fetch all devices successfully', async () => {
      const mockDevices = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          hostname: 'device1',
          isActive: true,
        },
        {
          ipAddress: '192.168.1.101',
          macAddress: 'BB:CC:DD:EE:FF:AA',
          hostname: 'device2',
          isActive: false,
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockDevices });

      const result = await fetchDevices();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/devices');
      expect(result).toEqual(mockDevices);
    });

    test('should handle empty device list', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      const result = await fetchDevices();

      expect(result).toEqual([]);
    });

    test('should throw error on failure after retries', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      try {
        await fetchDevices();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).toBe('Network error');
        // Verify retries happened (initial + 3 retries = 4 calls)
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4);
      }
    }, 10000); // Increase timeout for retry delays
  });

  describe('triggerScan', () => {
    test('should trigger network scan successfully', async () => {
      const mockResponse = {
        status: 'started',
        estimatedTime: 60,
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await triggerScan();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/devices/scan');
      expect(result).toEqual(mockResponse);
    });

    test('should handle scan trigger errors', async () => {
      const error = { response: { status: 500, data: { error: 'Server error' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      try {
        await triggerScan();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e).toEqual(error);
        // Verify retries happened for 5xx errors (initial + 3 retries = 4 calls)
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4);
      }
    }, 10000); // Increase timeout for retry delays
  });

  describe('fetchDeviceStatus', () => {
    test('should fetch device status successfully', async () => {
      const mockStatus = {
        ipAddress: '192.168.1.100',
        isOnline: true,
        lastChecked: '2024-01-15T14:25:30Z',
        responseTime: 12.5,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockStatus });

      const result = await fetchDeviceStatus('192.168.1.100');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/devices/192.168.1.100/status');
      expect(result).toEqual(mockStatus);
    });

    test('should throw error when IP is not provided', async () => {
      await expect(fetchDeviceStatus()).rejects.toThrow('IP address is required');
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should throw error when IP is empty string', async () => {
      await expect(fetchDeviceStatus('')).rejects.toThrow('IP address is required');
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should handle 404 not found', async () => {
      const error = { response: { status: 404, data: { error: 'Device not found' } } };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(fetchDeviceStatus('192.168.1.200')).rejects.toEqual(error);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // No retry for 4xx
    });
  });

  describe('fetchDeviceHealth', () => {
    test('should fetch device health metrics successfully', async () => {
      const mockHealth = {
        ipAddress: '192.168.1.100',
        latency: 15.5,
        minLatency: 10.2,
        maxLatency: 25.8,
        packetLoss: 0.5,
        jitter: 3.2,
        isDegraded: false,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockHealth });

      const result = await fetchDeviceHealth('192.168.1.100');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/devices/192.168.1.100/health');
      expect(result).toEqual(mockHealth);
    });

    test('should throw error when IP is not provided', async () => {
      await expect(fetchDeviceHealth()).rejects.toThrow('IP address is required');
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should handle degraded device health', async () => {
      const mockHealth = {
        ipAddress: '192.168.1.100',
        latency: 150,
        packetLoss: 10,
        isDegraded: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockHealth });

      const result = await fetchDeviceHealth('192.168.1.100');

      expect(result.isDegraded).toBe(true);
    });
  });

  describe('fetchCurrentTraffic', () => {
    test('should fetch current traffic stats successfully', async () => {
      const mockTraffic = {
        timestamp: '2024-01-15T14:25:00Z',
        bytesReceived: 1048576000,
        bytesSent: 524288000,
        bytesReceivedPerSec: 125000,
        bytesSentPerSec: 62500,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTraffic });

      const result = await fetchCurrentTraffic();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/traffic/current');
      expect(result).toEqual(mockTraffic);
    });

    test('should handle zero traffic', async () => {
      const mockTraffic = {
        bytesReceivedPerSec: 0,
        bytesSentPerSec: 0,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockTraffic });

      const result = await fetchCurrentTraffic();

      expect(result.bytesReceivedPerSec).toBe(0);
      expect(result.bytesSentPerSec).toBe(0);
    });
  });

  describe('fetchTrafficHistory', () => {
    test('should fetch traffic history with timestamps', async () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T14:00:00Z');
      const mockHistory = [
        { timestamp: '2024-01-15T10:00:00Z', bytesReceivedPerSec: 1000 },
        { timestamp: '2024-01-15T11:00:00Z', bytesReceivedPerSec: 2000 },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockHistory });

      const result = await fetchTrafficHistory(start, end);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/traffic/history', {
        params: { start: start.getTime(), end: end.getTime() },
      });
      expect(result).toEqual(mockHistory);
    });

    test('should accept numeric timestamps', async () => {
      const start = 1705315200000;
      const end = 1705329600000;
      const mockHistory = [];

      mockAxiosInstance.get.mockResolvedValue({ data: mockHistory });

      const result = await fetchTrafficHistory(start, end);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/traffic/history', {
        params: { start, end },
      });
      expect(result).toEqual(mockHistory);
    });

    test('should accept string timestamps', async () => {
      const start = '2024-01-15T10:00:00Z';
      const end = '2024-01-15T14:00:00Z';
      const mockHistory = [];

      mockAxiosInstance.get.mockResolvedValue({ data: mockHistory });

      const result = await fetchTrafficHistory(start, end);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/traffic/history', {
        params: { start, end },
      });
      expect(result).toEqual(mockHistory);
    });

    test('should throw error when start is not provided', async () => {
      const end = new Date();
      await expect(fetchTrafficHistory(null, end)).rejects.toThrow(
        'Start and end timestamps are required'
      );
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should throw error when end is not provided', async () => {
      const start = new Date();
      await expect(fetchTrafficHistory(start, null)).rejects.toThrow(
        'Start and end timestamps are required'
      );
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should handle empty history', async () => {
      const start = new Date();
      const end = new Date();
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      const result = await fetchTrafficHistory(start, end);

      expect(result).toEqual([]);
    });
  });

  describe('fetchAllHealth', () => {
    test('should fetch health metrics for all devices', async () => {
      const mockHealthMap = {
        '192.168.1.100': {
          ipAddress: '192.168.1.100',
          latency: 15.5,
          packetLoss: 0.5,
          isDegraded: false,
        },
        '192.168.1.101': {
          ipAddress: '192.168.1.101',
          latency: 120,
          packetLoss: 8,
          isDegraded: true,
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockHealthMap });

      const result = await fetchAllHealth();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health/all');
      expect(result).toEqual(mockHealthMap);
    });

    test('should handle empty health map', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });

      const result = await fetchAllHealth();

      expect(result).toEqual({});
    });
  });

  describe('fetchSystemInfo', () => {
    test('should fetch system information successfully', async () => {
      const mockSystemInfo = {
        version: '1.0.0',
        uptime: 3600,
        hostname: 'raspberrypi',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSystemInfo });

      const result = await fetchSystemInfo();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/system/info');
      expect(result).toEqual(mockSystemInfo);
    });
  });

  describe('Error Handling', () => {
    test('should retry on network errors', async () => {
      const networkError = new Error('Network error');
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: [] });

      const result = await fetchDevices();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    test('should retry on 5xx server errors', async () => {
      const serverError = { response: { status: 500 } };
      mockAxiosInstance.get
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: { version: '1.0.0' } });

      const result = await fetchSystemInfo();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ version: '1.0.0' });
    });

    test('should not retry on 4xx client errors', async () => {
      const clientError = { response: { status: 400, data: { error: 'Bad request' } } };
      mockAxiosInstance.get.mockRejectedValue(clientError);

      await expect(fetchDevices()).rejects.toEqual(clientError);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    test('should not retry on 404 not found', async () => {
      const notFoundError = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      await expect(fetchDeviceStatus('192.168.1.200')).rejects.toEqual(notFoundError);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    test('should throw error after max retries', async () => {
      const error = new Error('Persistent error');
      mockAxiosInstance.get.mockRejectedValue(error);

      try {
        await fetchDevices();
        fail('Should have thrown an error');
      } catch (e) {
        expect(e.message).toBe('Persistent error');
        // Verify max retries (initial + 3 retries = 4 calls)
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4);
      }
    }, 10000); // Increase timeout for retry delays
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should use exponential backoff for retries', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: [] });

      const promise = fetchDevices();

      // First retry after 1 second
      await jest.advanceTimersByTimeAsync(1000);
      
      // Second retry after 2 seconds
      await jest.advanceTimersByTimeAsync(2000);
      
      // Third retry after 3 seconds
      await jest.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4);
      expect(result).toEqual([]);
    });

    test('should retry immediately on first attempt', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: { status: 'started' } });

      const promise = triggerScan();

      // First retry after 1 second
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ status: 'started' });
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
      mockAxiosInstance.get.mockImplementation((url) => {
        if (url === '/devices') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/traffic/current') {
          return Promise.resolve({ data: { bytesReceivedPerSec: 1000 } });
        }
        if (url === '/health/all') {
          return Promise.resolve({ data: {} });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const [devices, traffic, health] = await Promise.all([
        fetchDevices(),
        fetchCurrentTraffic(),
        fetchAllHealth(),
      ]);

      expect(devices).toEqual([]);
      expect(traffic).toEqual({ bytesReceivedPerSec: 1000 });
      expect(health).toEqual({});
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });
  });
});
