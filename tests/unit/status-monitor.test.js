const StatusMonitor = require('../../server/components/StatusMonitor');

// Mock the ping module
jest.mock('ping', () => ({
  promise: {
    probe: jest.fn()
  }
}));

const ping = require('ping');

describe('StatusMonitor', () => {
  let monitor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    monitor = new StatusMonitor({ checkInterval: 1000 });
  });
  
  afterEach(() => {
    if (monitor) {
      monitor.stopAll();
    }
    jest.useRealTimers();
  });
  
  describe('startMonitoring', () => {
    test('should start monitoring a device', () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      monitor.startMonitoring(device);
      
      const statuses = monitor.getDeviceStatuses();
      expect(statuses.has('192.168.1.100')).toBe(true);
      expect(statuses.get('192.168.1.100').ipAddress).toBe('192.168.1.100');
    });
    
    test('should not start monitoring the same device twice', () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      monitor.startMonitoring(device);
      monitor.startMonitoring(device);
      
      const statuses = monitor.getDeviceStatuses();
      expect(statuses.size).toBe(1);
    });
  });
  
  describe('stopMonitoring', () => {
    test('should stop monitoring a device', () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      monitor.startMonitoring(device);
      monitor.stopMonitoring('192.168.1.100');
      
      const statuses = monitor.getDeviceStatuses();
      expect(statuses.has('192.168.1.100')).toBe(false);
    });
  });
  
  describe('status change detection', () => {
    test('should detect online to offline status change', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to return online first, then offline
      ping.promise.probe
        .mockResolvedValueOnce({ alive: true, time: '10.5' })
        .mockResolvedValueOnce({ alive: false, time: 'unknown' });
      
      const statusChanges = [];
      monitor.onStatusChange((ip, status) => {
        statusChanges.push({ ip, status });
      });
      
      monitor.startMonitoring(device);
      
      // Trigger first check (online)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Trigger second check (offline)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      expect(statusChanges.length).toBe(1);
      expect(statusChanges[0].ip).toBe('192.168.1.100');
      expect(statusChanges[0].status.isOnline).toBe(false);
      expect(statusChanges[0].status.responseTime).toBe(-1);
    });
    
    test('should detect offline to online status change', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: false
      };
      
      // Mock ping to return offline first, then online
      ping.promise.probe
        .mockResolvedValueOnce({ alive: false, time: 'unknown' })
        .mockResolvedValueOnce({ alive: true, time: '12.3' });
      
      const statusChanges = [];
      monitor.onStatusChange((ip, status) => {
        statusChanges.push({ ip, status });
      });
      
      monitor.startMonitoring(device);
      
      // Trigger first check (offline)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Trigger second check (online)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      expect(statusChanges.length).toBe(1);
      expect(statusChanges[0].ip).toBe('192.168.1.100');
      expect(statusChanges[0].status.isOnline).toBe(true);
      expect(statusChanges[0].status.responseTime).toBe(12.3);
    });
    
    test('should not emit status change when status remains the same', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to always return online
      ping.promise.probe.mockResolvedValue({ alive: true, time: '10.5' });
      
      const statusChanges = [];
      monitor.onStatusChange((ip, status) => {
        statusChanges.push({ ip, status });
      });
      
      monitor.startMonitoring(device);
      
      // Trigger multiple checks with same status
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Should not emit any status changes since status stayed online
      expect(statusChanges.length).toBe(0);
    });
    
    test('should update lastChecked timestamp on each check', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      ping.promise.probe.mockResolvedValue({ alive: true, time: '10.5' });
      
      monitor.startMonitoring(device);
      
      const initialStatus = monitor.getDeviceStatuses().get('192.168.1.100');
      const initialTimestamp = initialStatus.lastChecked.getTime();
      
      // Advance time and trigger check
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const updatedStatus = monitor.getDeviceStatuses().get('192.168.1.100');
      const updatedTimestamp = updatedStatus.lastChecked.getTime();
      
      expect(updatedTimestamp).toBeGreaterThan(initialTimestamp);
    });
  });
  
  describe('concurrent device monitoring', () => {
    test('should monitor multiple devices without blocking', async () => {
      const devices = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          hostname: 'device1',
          vendor: 'Vendor1',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.101',
          macAddress: 'AA:BB:CC:DD:EE:00',
          hostname: 'device2',
          vendor: 'Vendor2',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.102',
          macAddress: 'AA:BB:CC:DD:EE:01',
          hostname: 'device3',
          vendor: 'Vendor3',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        }
      ];
      
      ping.promise.probe.mockResolvedValue({ alive: true, time: '10.0' });
      
      devices.forEach(device => monitor.startMonitoring(device));
      
      const statuses = monitor.getDeviceStatuses();
      expect(statuses.size).toBe(3);
      expect(statuses.has('192.168.1.100')).toBe(true);
      expect(statuses.has('192.168.1.101')).toBe(true);
      expect(statuses.has('192.168.1.102')).toBe(true);
    });
    
    test('should respect concurrency limit when checking devices', async () => {
      const monitorWithLimit = new StatusMonitor({ 
        checkInterval: 1000, 
        concurrencyLimit: 2 
      });
      
      const devices = Array.from({ length: 5 }, (_, i) => ({
        ipAddress: `192.168.1.${100 + i}`,
        macAddress: `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0')}`,
        hostname: `device${i}`,
        vendor: `Vendor${i}`,
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      }));
      
      let concurrentChecks = 0;
      let maxConcurrentChecks = 0;
      
      // Mock ping to track concurrent calls
      ping.promise.probe.mockImplementation(() => {
        concurrentChecks++;
        maxConcurrentChecks = Math.max(maxConcurrentChecks, concurrentChecks);
        return new Promise(resolve => {
          setTimeout(() => {
            concurrentChecks--;
            resolve({ alive: true, time: '10.0' });
          }, 100);
        });
      });
      
      devices.forEach(device => monitorWithLimit.startMonitoring(device));
      
      // Trigger checks
      await jest.advanceTimersByTimeAsync(1000);
      
      // Wait for all checks to complete
      await jest.advanceTimersByTimeAsync(500);
      
      // Max concurrent checks should not exceed the limit
      expect(maxConcurrentChecks).toBeLessThanOrEqual(2);
      
      monitorWithLimit.stopAll();
    });
    
    test('should handle concurrent status changes for multiple devices', async () => {
      const devices = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          hostname: 'device1',
          vendor: 'Vendor1',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        },
        {
          ipAddress: '192.168.1.101',
          macAddress: 'AA:BB:CC:DD:EE:00',
          hostname: 'device2',
          vendor: 'Vendor2',
          firstSeen: new Date(),
          lastSeen: new Date(),
          isActive: true
        }
      ];
      
      // Mock different responses for different IPs
      ping.promise.probe.mockImplementation((ip) => {
        if (ip === '192.168.1.100') {
          return Promise.resolve({ alive: false, time: 'unknown' });
        }
        return Promise.resolve({ alive: true, time: '10.0' });
      });
      
      const statusChanges = [];
      monitor.onStatusChange((ip, status) => {
        statusChanges.push({ ip, status });
      });
      
      devices.forEach(device => monitor.startMonitoring(device));
      
      // Trigger checks
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Should detect status change for device1 (online -> offline)
      expect(statusChanges.length).toBe(1);
      expect(statusChanges[0].ip).toBe('192.168.1.100');
      expect(statusChanges[0].status.isOnline).toBe(false);
    });
  });
  
  describe('exponential backoff', () => {
    test('should apply exponential backoff for offline devices', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to always return offline
      ping.promise.probe.mockResolvedValue({ alive: false, time: 'unknown' });
      
      monitor.startMonitoring(device);
      
      // Get initial monitoring state
      const monitoringState = monitor.monitoringStates.get('192.168.1.100');
      const initialInterval = monitoringState.checkInterval;
      expect(initialInterval).toBe(1000);
      
      // Trigger first check (offline)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Check that backoff was applied after first failure
      const afterFirstCheck = monitor.monitoringStates.get('192.168.1.100');
      expect(afterFirstCheck.consecutiveFailures).toBe(1);
      expect(afterFirstCheck.backoffMultiplier).toBe(1);
      expect(afterFirstCheck.checkInterval).toBe(1000); // 1000 * 1 = 1000
      
      // Trigger second check (offline)
      await jest.advanceTimersByTimeAsync(afterFirstCheck.checkInterval);
      await Promise.resolve();
      
      const afterSecondCheck = monitor.monitoringStates.get('192.168.1.100');
      expect(afterSecondCheck.checkInterval).toBeGreaterThan(initialInterval);
      expect(afterSecondCheck.consecutiveFailures).toBe(2);
      expect(afterSecondCheck.backoffMultiplier).toBe(2);
      expect(afterSecondCheck.checkInterval).toBe(2000); // 1000 * 2 = 2000
    });
    
    test('should reset backoff when device comes back online', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to return offline first, then online
      ping.promise.probe
        .mockResolvedValueOnce({ alive: false, time: 'unknown' })
        .mockResolvedValueOnce({ alive: false, time: 'unknown' })
        .mockResolvedValueOnce({ alive: true, time: '10.5' });
      
      monitor.startMonitoring(device);
      
      // First check - offline
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const afterFirstCheck = monitor.monitoringStates.get('192.168.1.100');
      const firstCheckInterval = afterFirstCheck.checkInterval;
      
      // Second check - offline
      await jest.advanceTimersByTimeAsync(firstCheckInterval);
      await Promise.resolve();
      
      const afterSecondCheck = monitor.monitoringStates.get('192.168.1.100');
      expect(afterSecondCheck.consecutiveFailures).toBe(2);
      expect(afterSecondCheck.checkInterval).toBeGreaterThan(firstCheckInterval);
      
      // Third check - online
      await jest.advanceTimersByTimeAsync(afterSecondCheck.checkInterval);
      await Promise.resolve();
      
      const afterThirdCheck = monitor.monitoringStates.get('192.168.1.100');
      expect(afterThirdCheck.consecutiveFailures).toBe(0);
      expect(afterThirdCheck.backoffMultiplier).toBe(1);
      expect(afterThirdCheck.checkInterval).toBe(1000); // Reset to default
    });
    
    test('should cap backoff at maximum interval', async () => {
      const monitorWithMaxBackoff = new StatusMonitor({ 
        checkInterval: 1000, 
        maxBackoffInterval: 5000 
      });
      
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to always return offline
      ping.promise.probe.mockResolvedValue({ alive: false, time: 'unknown' });
      
      monitorWithMaxBackoff.startMonitoring(device);
      
      // Trigger multiple checks to reach max backoff
      for (let i = 0; i < 10; i++) {
        const state = monitorWithMaxBackoff.monitoringStates.get('192.168.1.100');
        await jest.advanceTimersByTimeAsync(state.checkInterval);
        await Promise.resolve();
      }
      
      const finalState = monitorWithMaxBackoff.monitoringStates.get('192.168.1.100');
      expect(finalState.checkInterval).toBeLessThanOrEqual(5000);
      
      monitorWithMaxBackoff.stopAll();
    });
    
    test('should increase backoff exponentially with each failure', async () => {
      const device = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        hostname: 'test-device',
        vendor: 'Test Vendor',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isActive: true
      };
      
      // Mock ping to always return offline
      ping.promise.probe.mockResolvedValue({ alive: false, time: 'unknown' });
      
      monitor.startMonitoring(device);
      
      const intervals = [];
      
      // Collect intervals after each check
      for (let i = 0; i < 5; i++) {
        const state = monitor.monitoringStates.get('192.168.1.100');
        intervals.push(state.checkInterval);
        await jest.advanceTimersByTimeAsync(state.checkInterval);
        await Promise.resolve();
      }
      
      // Verify exponential growth
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
      }
    });
  });
});
