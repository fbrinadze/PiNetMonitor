const ping = require('ping');
const EventEmitter = require('events');

/**
 * @typedef {Object} HealthMetrics
 * @property {string} ipAddress
 * @property {number} latency - Average latency in ms, -1 if unreachable
 * @property {number} minLatency - Minimum latency in measurement window
 * @property {number} maxLatency - Maximum latency in measurement window
 * @property {number} packetLoss - Packet loss percentage (0-100)
 * @property {number} jitter - Latency variation in ms
 * @property {Date} lastUpdated
 * @property {boolean} isDegraded - True if latency > 100ms or packet loss > 5%
 */

/**
 * @typedef {Object} MonitoringState
 * @property {NodeJS.Timeout|null} intervalId
 * @property {number} updateInterval - milliseconds
 */

/**
 * HealthMonitor measures network health metrics (latency, packet loss) for each device
 */
class HealthMonitor extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.updateInterval=60000] - Update interval in milliseconds (default: 60 seconds)
   * @param {number} [options.pingCount=10] - Number of ping packets per measurement cycle
   * @param {number} [options.pingTimeout=2] - Ping timeout in seconds
   * @param {number} [options.degradedLatencyThreshold=100] - Latency threshold for degraded performance (ms)
   * @param {number} [options.degradedPacketLossThreshold=5] - Packet loss threshold for degraded performance (%)
   */
  constructor(options = {}) {
    super();
    
    /** @type {number} Update interval in milliseconds */
    this.updateInterval = options.updateInterval || 60000;
    
    /** @type {number} Number of ping packets per measurement cycle */
    this.pingCount = options.pingCount || 10;
    
    /** @type {number} Ping timeout in seconds */
    this.pingTimeout = options.pingTimeout || 2;
    
    /** @type {number} Latency threshold for degraded performance (ms) */
    this.degradedLatencyThreshold = options.degradedLatencyThreshold || 100;
    
    /** @type {number} Packet loss threshold for degraded performance (%) */
    this.degradedPacketLossThreshold = options.degradedPacketLossThreshold || 5;
    
    /** @type {Map<string, HealthMetrics>} Current health metrics for all monitored devices */
    this.healthMetrics = new Map();
    
    /** @type {Map<string, MonitoringState>} Monitoring state for each device */
    this.monitoringStates = new Map();
  }

  /**
   * Start health monitoring for a device
   * @param {string} ipAddress - IP address of device to monitor
   */
  startMonitoring(ipAddress) {
    // If already monitoring, don't start again
    if (this.monitoringStates.has(ipAddress)) {
      return;
    }
    
    // Initialize health metrics
    this.healthMetrics.set(ipAddress, {
      ipAddress,
      latency: -1,
      minLatency: -1,
      maxLatency: -1,
      packetLoss: 0,
      jitter: 0,
      lastUpdated: new Date(),
      isDegraded: false
    });
    
    // Initialize monitoring state
    const monitoringState = {
      intervalId: null,
      updateInterval: this.updateInterval
    };
    
    this.monitoringStates.set(ipAddress, monitoringState);
    
    // Start the monitoring loop
    this._scheduleUpdate(ipAddress);
  }

  /**
   * Stop health monitoring for a device
   * @param {string} ipAddress - IP address of device to stop monitoring
   */
  stopMonitoring(ipAddress) {
    const monitoringState = this.monitoringStates.get(ipAddress);
    
    if (monitoringState && monitoringState.intervalId) {
      clearTimeout(monitoringState.intervalId);
    }
    
    this.monitoringStates.delete(ipAddress);
    this.healthMetrics.delete(ipAddress);
  }

  /**
   * Get current health metrics for a specific device
   * @param {string} ipAddress - IP address of device
   * @returns {HealthMetrics|undefined} Health metrics or undefined if not monitoring
   */
  getHealthMetrics(ipAddress) {
    return this.healthMetrics.get(ipAddress);
  }

  /**
   * Get all health metrics
   * @returns {Map<string, HealthMetrics>} Map of IP addresses to health metrics
   */
  getAllHealthMetrics() {
    return new Map(this.healthMetrics);
  }

  /**
   * Register callback for health updates
   * @param {function(string, HealthMetrics): void} callback - Callback function
   */
  onHealthUpdate(callback) {
    this.on('healthUpdate', callback);
  }

  /**
   * Schedule a health update for a device
   * @private
   * @param {string} ipAddress - IP address to update
   */
  _scheduleUpdate(ipAddress) {
    const monitoringState = this.monitoringStates.get(ipAddress);
    
    if (!monitoringState) {
      return;
    }
    
    // Clear any existing timeout
    if (monitoringState.intervalId) {
      clearTimeout(monitoringState.intervalId);
    }
    
    // Schedule the next update
    monitoringState.intervalId = setTimeout(() => {
      this._measureHealth(ipAddress);
    }, monitoringState.updateInterval);
  }

  /**
   * Measure health metrics for a device
   * @private
   * @param {string} ipAddress - IP address to measure
   */
  async _measureHealth(ipAddress) {
    const monitoringState = this.monitoringStates.get(ipAddress);
    
    if (!monitoringState) {
      return;
    }
    
    try {
      // Send multiple ping packets
      const pingResults = [];
      
      for (let i = 0; i < this.pingCount; i++) {
        const result = await ping.promise.probe(ipAddress, {
          timeout: this.pingTimeout,
          min_reply: 1
        });
        pingResults.push(result);
      }
      
      // Calculate metrics
      const successfulPings = pingResults.filter(r => r.alive);
      const latencies = successfulPings.map(r => parseFloat(r.time));
      
      const packetLoss = ((this.pingCount - successfulPings.length) / this.pingCount) * 100;
      
      let latency = -1;
      let minLatency = -1;
      let maxLatency = -1;
      let jitter = 0;
      
      if (latencies.length > 0) {
        latency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        minLatency = Math.min(...latencies);
        maxLatency = Math.max(...latencies);
        
        // Calculate jitter (standard deviation of latencies)
        if (latencies.length > 1) {
          const variance = latencies.reduce((sum, val) => {
            return sum + Math.pow(val - latency, 2);
          }, 0) / latencies.length;
          jitter = Math.sqrt(variance);
        }
      }
      
      // Determine if performance is degraded
      const isDegraded = (latency > this.degradedLatencyThreshold && latency !== -1) || 
                         packetLoss > this.degradedPacketLossThreshold;
      
      // Update health metrics
      const metrics = {
        ipAddress,
        latency,
        minLatency,
        maxLatency,
        packetLoss,
        jitter,
        lastUpdated: new Date(),
        isDegraded
      };
      
      this.healthMetrics.set(ipAddress, metrics);
      
      // Emit health update event
      this.emit('healthUpdate', ipAddress, metrics);
      
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error(`Error measuring health for device ${ipAddress}:`, err.message);
    } finally {
      // Schedule next update
      this._scheduleUpdate(ipAddress);
    }
  }

  /**
   * Stop monitoring all devices and cleanup
   */
  stopAll() {
    for (const ipAddress of this.monitoringStates.keys()) {
      this.stopMonitoring(ipAddress);
    }
  }
}

module.exports = HealthMonitor;
