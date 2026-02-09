const TrafficAnalyzer = require('../../server/components/TrafficAnalyzer');

// Mock the systeminformation module
jest.mock('systeminformation', () => ({
  networkStats: jest.fn()
}));

const si = require('systeminformation');

describe('TrafficAnalyzer', () => {
  let analyzer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    analyzer = new TrafficAnalyzer({ 
      sampleInterval: 1000,
      historyGranularity: 60000 // 1 minute
    });
  });
  
  afterEach(() => {
    if (analyzer) {
      analyzer.stopMonitoring();
    }
    jest.useRealTimers();
  });
  
  describe('startMonitoring', () => {
    test('should start monitoring a network interface', () => {
      analyzer.startMonitoring('eth0');
      
      expect(analyzer.isMonitoring).toBe(true);
      expect(analyzer.interfaceName).toBe('eth0');
      expect(analyzer.intervalId).not.toBeNull();
    });
    
    test('should not start monitoring if already active', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      analyzer.startMonitoring('eth0');
      const firstIntervalId = analyzer.intervalId;
      
      analyzer.startMonitoring('eth0');
      const secondIntervalId = analyzer.intervalId;
      
      expect(firstIntervalId).toBe(secondIntervalId);
      expect(consoleSpy).toHaveBeenCalledWith('Traffic monitoring is already active');
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('stopMonitoring', () => {
    test('should stop monitoring', () => {
      analyzer.startMonitoring('eth0');
      analyzer.stopMonitoring();
      
      expect(analyzer.isMonitoring).toBe(false);
      expect(analyzer.interfaceName).toBeNull();
      expect(analyzer.intervalId).toBeNull();
    });
    
    test('should handle stop when not monitoring', () => {
      expect(() => analyzer.stopMonitoring()).not.toThrow();
    });
  });
  
  describe('rate calculation accuracy', () => {
    test('should calculate bytes per second correctly', async () => {
      // Mock initial stats
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Mock second stats (1 second later, 10000 bytes received, 5000 bytes sent)
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 1010000,
        tx_bytes: 505000,
        rx_sec: 110,
        tx_sec: 55
      }]);
      
      // Second sample
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      expect(stats).not.toBeNull();
      expect(stats.bytesReceivedPerSec).toBeCloseTo(10000, 0);
      expect(stats.bytesSentPerSec).toBeCloseTo(5000, 0);
    });
    
    test('should handle zero rate when no traffic', async () => {
      // Mock stats with no change
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Second sample (no change)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      expect(stats.bytesReceivedPerSec).toBe(0);
      expect(stats.bytesSentPerSec).toBe(0);
    });
    
    test('should not calculate negative rates', async () => {
      // Mock initial stats
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Mock second stats with lower values (counter reset scenario)
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 100,
        tx_bytes: 50,
        rx_sec: 10,
        tx_sec: 5
      }]);
      
      // Second sample
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      expect(stats.bytesReceivedPerSec).toBeGreaterThanOrEqual(0);
      expect(stats.bytesSentPerSec).toBeGreaterThanOrEqual(0);
    });
    
    test('should calculate rates correctly over different time intervals', async () => {
      // Mock initial stats
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Mock second stats (after 1 second, 10000 bytes received)
      si.networkStats.mockResolvedValueOnce([{
        rx_bytes: 1010000,
        tx_bytes: 505000,
        rx_sec: 110,
        tx_sec: 55
      }]);
      
      // Second sample (1 second later)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      // Rate should be 10000 bytes / 1 second = 10000 bytes/sec
      expect(stats.bytesReceivedPerSec).toBeCloseTo(10000, 0);
      expect(stats.bytesSentPerSec).toBeCloseTo(5000, 0);
    });
  });
  
  describe('circular buffer behavior', () => {
    test('should add data to historical buffer', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Advance by history granularity to trigger save
      await jest.advanceTimersByTimeAsync(60000);
      await Promise.resolve();
      
      expect(analyzer.historicalStats.length).toBeGreaterThan(0);
    });
    
    test('should respect history granularity', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      const initialHistoryLength = analyzer.historicalStats.length;
      
      // Advance by less than granularity
      await jest.advanceTimersByTimeAsync(30000);
      await Promise.resolve();
      
      // Should not add to history yet
      expect(analyzer.historicalStats.length).toBe(initialHistoryLength);
      
      // Advance past granularity
      await jest.advanceTimersByTimeAsync(30000);
      await Promise.resolve();
      
      // Should add to history now
      expect(analyzer.historicalStats.length).toBeGreaterThan(initialHistoryLength);
    });
    
    test('should remove oldest entries when buffer is full', async () => {
      // Create analyzer with small buffer
      const smallAnalyzer = new TrafficAnalyzer({
        sampleInterval: 1000,
        historyDuration: 180000, // 3 minutes
        historyGranularity: 60000 // 1 minute
      });
      
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      smallAnalyzer.startMonitoring('eth0');
      
      // Max entries should be 3 (180000 / 60000)
      expect(smallAnalyzer.maxHistoryEntries).toBe(3);
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Add 5 entries (more than max)
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(60000);
        await Promise.resolve();
      }
      
      // Buffer should not exceed max
      expect(smallAnalyzer.historicalStats.length).toBeLessThanOrEqual(3);
      
      smallAnalyzer.stopMonitoring();
    });
    
    test('should maintain FIFO order in circular buffer', async () => {
      const smallAnalyzer = new TrafficAnalyzer({
        sampleInterval: 1000,
        historyDuration: 120000, // 2 minutes
        historyGranularity: 60000 // 1 minute
      });
      
      let counter = 1000000;
      si.networkStats.mockImplementation(() => {
        counter += 10000;
        return Promise.resolve([{
          rx_bytes: counter,
          tx_bytes: counter / 2,
          rx_sec: 100,
          tx_sec: 50
        }]);
      });
      
      smallAnalyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Add 4 entries (more than max of 2)
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(60000);
        await Promise.resolve();
      }
      
      // Should have only 2 entries (the most recent ones)
      expect(smallAnalyzer.historicalStats.length).toBe(2);
      
      // Verify oldest entry was removed (first entry should have higher bytesReceived)
      const firstEntry = smallAnalyzer.historicalStats[0];
      const secondEntry = smallAnalyzer.historicalStats[1];
      expect(secondEntry.bytesReceived).toBeGreaterThan(firstEntry.bytesReceived);
      
      smallAnalyzer.stopMonitoring();
    });
  });
  
  describe('historical data retrieval', () => {
    test('should retrieve historical data within time range', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      const startTime = new Date();
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Add multiple entries
      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(60000);
        await Promise.resolve();
      }
      
      const endTime = new Date(Date.now() + 180000);
      
      const historicalData = analyzer.getHistoricalStats(startTime, endTime);
      expect(historicalData.length).toBeGreaterThan(0);
      
      // Verify all entries are within range
      historicalData.forEach(stats => {
        expect(stats.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(stats.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
      });
    });
    
    test('should return empty array when no data in range', () => {
      const startTime = new Date('2020-01-01');
      const endTime = new Date('2020-01-02');
      
      const historicalData = analyzer.getHistoricalStats(startTime, endTime);
      expect(historicalData).toEqual([]);
    });
    
    test('should calculate statistics summary correctly', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Add entries with known rates
      const rates = [10000, 20000, 30000];
      for (let i = 0; i < rates.length; i++) {
        si.networkStats.mockResolvedValueOnce([{
          rx_bytes: 1000000 + rates[i] * (i + 1),
          tx_bytes: 500000 + rates[i] * (i + 1) / 2,
          rx_sec: 100,
          tx_sec: 50
        }]);
        
        await jest.advanceTimersByTimeAsync(60000);
        await Promise.resolve();
      }
      
      const summary = analyzer.getStatsSummary();
      
      expect(summary.minBytesReceivedPerSec).toBeLessThanOrEqual(summary.avgBytesReceivedPerSec);
      expect(summary.avgBytesReceivedPerSec).toBeLessThanOrEqual(summary.maxBytesReceivedPerSec);
      expect(summary.minBytesSentPerSec).toBeLessThanOrEqual(summary.avgBytesSentPerSec);
      expect(summary.avgBytesSentPerSec).toBeLessThanOrEqual(summary.maxBytesSentPerSec);
    });
    
    test('should return zero summary when no historical data', () => {
      const summary = analyzer.getStatsSummary();
      
      expect(summary.avgBytesReceivedPerSec).toBe(0);
      expect(summary.avgBytesSentPerSec).toBe(0);
      expect(summary.minBytesReceivedPerSec).toBe(0);
      expect(summary.minBytesSentPerSec).toBe(0);
      expect(summary.maxBytesReceivedPerSec).toBe(0);
      expect(summary.maxBytesSentPerSec).toBe(0);
    });
  });
  
  describe('interface unavailability handling', () => {
    test('should handle missing interface gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock no stats available
      si.networkStats.mockResolvedValue([]);
      
      analyzer.startMonitoring('eth0');
      
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No statistics available for interface eth0')
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should handle systeminformation errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock error
      si.networkStats.mockRejectedValue(new Error('Interface not found'));
      
      analyzer.startMonitoring('eth0');
      
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error sampling traffic for interface eth0'),
        'Interface not found'
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should continue monitoring after error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock error first, then success
      si.networkStats
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce([{
          rx_bytes: 1000000,
          tx_bytes: 500000,
          rx_sec: 100,
          tx_sec: 50
        }]);
      
      analyzer.startMonitoring('eth0');
      
      // First sample (error)
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      expect(consoleSpy).toHaveBeenCalled();
      
      // Second sample (success)
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      expect(stats).not.toBeNull();
      expect(stats.bytesReceived).toBe(1000000);
      
      consoleSpy.mockRestore();
    });
    
    test('should handle missing rx_bytes and tx_bytes fields', async () => {
      // Mock stats without required fields
      si.networkStats.mockResolvedValue([{
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      analyzer.startMonitoring('eth0');
      
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      const stats = analyzer.getCurrentStats();
      expect(stats).not.toBeNull();
      expect(stats.bytesReceived).toBe(0);
      expect(stats.bytesSent).toBe(0);
    });
  });
  
  describe('event emission', () => {
    test('should emit trafficUpdate event on each sample', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      const updates = [];
      analyzer.onTrafficUpdate((stats) => {
        updates.push(stats);
      });
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      // Second sample
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      expect(updates.length).toBe(2);
      expect(updates[0]).toHaveProperty('timestamp');
      expect(updates[0]).toHaveProperty('bytesReceived');
      expect(updates[0]).toHaveProperty('bytesSent');
      expect(updates[0]).toHaveProperty('bytesReceivedPerSec');
      expect(updates[0]).toHaveProperty('bytesSentPerSec');
    });
    
    test('should not emit events when monitoring is stopped', async () => {
      si.networkStats.mockResolvedValue([{
        rx_bytes: 1000000,
        tx_bytes: 500000,
        rx_sec: 100,
        tx_sec: 50
      }]);
      
      const updates = [];
      analyzer.onTrafficUpdate((stats) => {
        updates.push(stats);
      });
      
      analyzer.startMonitoring('eth0');
      
      // First sample
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      
      analyzer.stopMonitoring();
      
      const updateCountAfterStop = updates.length;
      
      // Try to trigger another sample
      await jest.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      
      // Should not have new updates
      expect(updates.length).toBe(updateCountAfterStop);
    });
  });
});
