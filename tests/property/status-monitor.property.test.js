const fc = require('fast-check');
const StatusMonitor = require('../../server/components/StatusMonitor');

// Mock the ping module
jest.mock('ping', () => ({
  promise: {
    probe: jest.fn()
  }
}));

const ping = require('ping');

describe('StatusMonitor Property Tests', () => {
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

  // Feature: network-monitor, Property 4: Status Timestamp Maintenance
  describe('Property 4: Status Timestamp Maintenance', () => {
    test('for any device being monitored, status must contain valid lastChecked timestamp not in the future', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random device data
          fc.record({
            ipAddress: fc.ipV4(),
            macAddress: fc.hexaString({ minLength: 17, maxLength: 17 }).map(s => {
              // Format as MAC address AA:BB:CC:DD:EE:FF
              return s.match(/.{1,2}/g).join(':').toUpperCase();
            }),
            hostname: fc.oneof(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.constant('unknown')
            ),
            vendor: fc.string({ minLength: 1, maxLength: 30 }),
            isActive: fc.boolean()
          }),
          // Generate random ping response
          fc.record({
            alive: fc.boolean(),
            time: fc.oneof(
              fc.float({ min: Math.fround(0.1), max: Math.fround(500) }).map(n => n.toFixed(1)),
              fc.constant('unknown')
            )
          }),
          async (deviceData, pingResponse) => {
            // Create device object with required Date fields
            const device = {
              ...deviceData,
              firstSeen: new Date(),
              lastSeen: new Date()
            };
            
            // Mock ping response
            ping.promise.probe.mockResolvedValue(pingResponse);
            
            // Capture the current time before starting monitoring
            const beforeMonitoring = new Date();
            
            // Start monitoring the device
            monitor.startMonitoring(device);
            
            // Get initial status
            const initialStatus = monitor.getDeviceStatuses().get(device.ipAddress);
            
            // Property: Initial status must have valid lastChecked timestamp
            expect(initialStatus).toBeDefined();
            expect(initialStatus.lastChecked).toBeInstanceOf(Date);
            expect(initialStatus.lastChecked.getTime()).not.toBeNaN();
            expect(initialStatus.lastChecked.getTime()).toBeLessThanOrEqual(Date.now());
            expect(initialStatus.lastChecked.getTime()).toBeGreaterThanOrEqual(beforeMonitoring.getTime());
            
            // Trigger a check by advancing timers
            const beforeCheck = new Date();
            await jest.advanceTimersByTimeAsync(1000);
            await Promise.resolve(); // Allow promises to resolve
            
            // Get status after check
            const statusAfterCheck = monitor.getDeviceStatuses().get(device.ipAddress);
            
            // Property: Status after check must have valid lastChecked timestamp not in the future
            expect(statusAfterCheck).toBeDefined();
            expect(statusAfterCheck.lastChecked).toBeInstanceOf(Date);
            expect(statusAfterCheck.lastChecked.getTime()).not.toBeNaN();
            expect(statusAfterCheck.lastChecked.getTime()).toBeLessThanOrEqual(Date.now());
            expect(statusAfterCheck.lastChecked.getTime()).toBeGreaterThanOrEqual(beforeCheck.getTime());
            
            // Clean up
            monitor.stopMonitoring(device.ipAddress);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
