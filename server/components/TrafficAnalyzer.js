const si = require('systeminformation');
const EventEmitter = require('events');

/**
 * @typedef {Object} TrafficStats
 * @property {Date} timestamp
 * @property {number} bytesReceived - Total bytes received
 * @property {number} bytesSent - Total bytes sent
 * @property {number} bytesReceivedPerSec - Current receive rate
 * @property {number} bytesSentPerSec - Current send rate
 * @property {number} packetsReceived
 * @property {number} packetsSent
 */

/**
 * TrafficAnalyzer monitors network traffic on the Raspberry Pi's network interface
 */
class TrafficAnalyzer extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.sampleInterval=1000] - Sampling interval in milliseconds (default: 1 second)
   * @param {number} [options.historyDuration=86400000] - History duration in milliseconds (default: 24 hours)
   * @param {number} [options.historyGranularity=60000] - History granularity in milliseconds (default: 1 minute)
   */
  constructor(options = {}) {
    super();
    
    /** @type {number} Sampling interval in milliseconds */
    this.sampleInterval = options.sampleInterval || 1000;
    
    /** @type {number} History duration in milliseconds (24 hours) */
    this.historyDuration = options.historyDuration || 86400000;
    
    /** @type {number} History granularity in milliseconds (1 minute) */
    this.historyGranularity = options.historyGranularity || 60000;
    
    /** @type {string|null} Network interface being monitored */
    this.interfaceName = null;
    
    /** @type {NodeJS.Timeout|null} Interval timer for sampling */
    this.intervalId = null;
    
    /** @type {TrafficStats|null} Current traffic statistics */
    this.currentStats = null;
    
    /** @type {TrafficStats[]} Circular buffer for historical data */
    this.historicalStats = [];
    
    /** @type {number} Maximum number of historical entries */
    this.maxHistoryEntries = Math.floor(this.historyDuration / this.historyGranularity);
    
    /** @type {any|null} Previous network stats for rate calculation */
    this.previousStats = null;
    
    /** @type {Date|null} Timestamp of previous stats */
    this.previousTimestamp = null;
    
    /** @type {Date|null} Last time historical data was saved */
    this.lastHistorySave = null;
    
    /** @type {boolean} Whether monitoring is active */
    this.isMonitoring = false;
  }

  /**
   * Start traffic monitoring on a network interface
   * @param {string} interfaceName - Name of the network interface to monitor (e.g., "eth0", "wlan0")
   */
  startMonitoring(interfaceName) {
    if (this.isMonitoring) {
      console.warn('Traffic monitoring is already active');
      return;
    }
    
    this.interfaceName = interfaceName;
    this.isMonitoring = true;
    this.previousStats = null;
    this.previousTimestamp = null;
    this.lastHistorySave = new Date();
    
    // Start the monitoring loop
    this._startSampling();
  }

  /**
   * Stop traffic monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isMonitoring = false;
    this.interfaceName = null;
    this.previousStats = null;
    this.previousTimestamp = null;
  }

  /**
   * Get current traffic statistics
   * @returns {TrafficStats|null} Current traffic statistics or null if not monitoring
   */
  getCurrentStats() {
    return this.currentStats;
  }

  /**
   * Get historical traffic data within a time range
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {TrafficStats[]} Array of traffic statistics within the time range
   */
  getHistoricalStats(startTime, endTime) {
    return this.historicalStats.filter(stats => {
      const timestamp = stats.timestamp.getTime();
      return timestamp >= startTime.getTime() && timestamp <= endTime.getTime();
    });
  }

  /**
   * Register callback for traffic updates
   * @param {function(TrafficStats): void} callback - Callback function
   */
  onTrafficUpdate(callback) {
    this.on('trafficUpdate', callback);
  }

  /**
   * Start the sampling loop
   * @private
   */
  _startSampling() {
    // Perform initial sample
    this._sampleTraffic();
    
    // Set up interval for continuous sampling
    this.intervalId = setInterval(() => {
      this._sampleTraffic();
    }, this.sampleInterval);
  }

  /**
   * Sample network traffic statistics
   * @private
   */
  async _sampleTraffic() {
    try {
      // Get network statistics for the specified interface
      const networkStats = await si.networkStats(this.interfaceName || undefined);
      
      // networkStats returns an array, get the first interface
      const stats = Array.isArray(networkStats) ? networkStats[0] : networkStats;
      
      if (!stats) {
        console.error(`No statistics available for interface ${this.interfaceName}`);
        return;
      }
      
      const now = new Date();
      
      // Calculate rates if we have previous data
      let bytesReceivedPerSec = 0;
      let bytesSentPerSec = 0;
      
      if (this.previousStats && this.previousTimestamp) {
        const timeDelta = (now.getTime() - this.previousTimestamp.getTime()) / 1000; // seconds
        
        if (timeDelta > 0) {
          const bytesDelta = (stats.rx_bytes || 0) - (this.previousStats.rx_bytes || 0);
          const bytesSentDelta = (stats.tx_bytes || 0) - (this.previousStats.tx_bytes || 0);
          
          bytesReceivedPerSec = Math.max(0, bytesDelta / timeDelta);
          bytesSentPerSec = Math.max(0, bytesSentDelta / timeDelta);
        }
      }
      
      // Create current stats object
      this.currentStats = {
        timestamp: now,
        bytesReceived: stats.rx_bytes || 0,
        bytesSent: stats.tx_bytes || 0,
        bytesReceivedPerSec,
        bytesSentPerSec,
        packetsReceived: stats.rx_sec || 0,
        packetsSent: stats.tx_sec || 0
      };
      
      // Store current stats for next rate calculation
      this.previousStats = stats;
      this.previousTimestamp = now;
      
      // Emit traffic update event
      this.emit('trafficUpdate', this.currentStats);
      
      // Save to historical data if enough time has passed
      this._saveToHistory(this.currentStats);
      
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error(`Error sampling traffic for interface ${this.interfaceName}:`, err.message);
    }
  }

  /**
   * Save traffic statistics to historical buffer
   * @private
   * @param {TrafficStats} stats - Traffic statistics to save
   */
  _saveToHistory(stats) {
    const now = stats.timestamp;
    
    // Only save if enough time has passed since last save (based on granularity)
    if (this.lastHistorySave) {
      const timeSinceLastSave = now.getTime() - this.lastHistorySave.getTime();
      if (timeSinceLastSave < this.historyGranularity) {
        return;
      }
    }
    
    // Add to circular buffer
    this.historicalStats.push(stats);
    
    // Remove oldest entries if buffer is full
    if (this.historicalStats.length > this.maxHistoryEntries) {
      this.historicalStats.shift();
    }
    
    this.lastHistorySave = now;
  }

  /**
   * Get traffic statistics summary (average, min, max)
   * @param {Date} [startTime] - Start of time range (optional, defaults to all historical data)
   * @param {Date} [endTime] - End of time range (optional, defaults to now)
   * @returns {Object} Summary statistics
   */
  getStatsSummary(startTime, endTime) {
    const stats = startTime && endTime 
      ? this.getHistoricalStats(startTime, endTime)
      : this.historicalStats;
    
    if (stats.length === 0) {
      return {
        avgBytesReceivedPerSec: 0,
        avgBytesSentPerSec: 0,
        minBytesReceivedPerSec: 0,
        minBytesSentPerSec: 0,
        maxBytesReceivedPerSec: 0,
        maxBytesSentPerSec: 0
      };
    }
    
    const receivedRates = stats.map(s => s.bytesReceivedPerSec);
    const sentRates = stats.map(s => s.bytesSentPerSec);
    
    return {
      avgBytesReceivedPerSec: receivedRates.reduce((a, b) => a + b, 0) / receivedRates.length,
      avgBytesSentPerSec: sentRates.reduce((a, b) => a + b, 0) / sentRates.length,
      minBytesReceivedPerSec: Math.min(...receivedRates),
      minBytesSentPerSec: Math.min(...sentRates),
      maxBytesReceivedPerSec: Math.max(...receivedRates),
      maxBytesSentPerSec: Math.max(...sentRates)
    };
  }
}

module.exports = TrafficAnalyzer;
