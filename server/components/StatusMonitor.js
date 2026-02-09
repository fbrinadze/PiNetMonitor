const ping = require('ping');
const EventEmitter = require('events');

/**
 * @typedef {Object} Device
 * @property {string} ipAddress
 * @property {string} macAddress
 * @property {string} hostname
 * @property {string} vendor
 * @property {Date} firstSeen
 * @property {Date} lastSeen
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} DeviceStatus
 * @property {string} ipAddress
 * @property {boolean} isOnline
 * @property {Date} lastChecked
 * @property {number} responseTime - milliseconds, -1 if offline
 */

/**
 * @typedef {Object} MonitoringState
 * @property {NodeJS.Timeout|null} intervalId
 * @property {number} checkInterval - milliseconds
 * @property {number} consecutiveFailures
 * @property {number} backoffMultiplier
 */

/**
 * StatusMonitor continuously monitors the connectivity status of discovered devices
 */
class StatusMonitor extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.checkInterval=30000] - Default check interval in milliseconds
   * @param {number} [options.concurrencyLimit=10] - Maximum concurrent ping operations
   * @param {number} [options.maxBackoffInterval=300000] - Maximum backoff interval (5 minutes)
   */
  constructor(options = {}) {
    super();
    
    /** @type {number} Default check interval in milliseconds */
    this.defaultCheckInterval = options.checkInterval || 30000;
    
    /** @type {number} Maximum concurrent ping operations */
    this.concurrencyLimit = options.concurrencyLimit || 10;
    
    /** @type {number} Maximum backoff interval in milliseconds */
    this.maxBackoffInterval = options.maxBackoffInterval || 300000;
    
    /** @type {Map<string, DeviceStatus>} Current status of all monitored devices */
    this.deviceStatuses = new Map();
    
    /** @type {Map<string, MonitoringState>} Monitoring state for each device */
    this.monitoringStates = new Map();
    
    /** @type {Set<string>} Currently running checks */
    this.activeChecks = new Set();
  }

  /**
   * Start monitoring a device
   * @param {Device} device - Device to monitor
   */
  startMonitoring(device) {
    const { ipAddress } = device;
    
    // If already monitoring, don't start again
    if (this.monitoringStates.has(ipAddress)) {
      return;
    }
    
    // Initialize device status
    this.deviceStatuses.set(ipAddress, {
      ipAddress,
      isOnline: device.isActive,
      lastChecked: new Date(),
      responseTime: -1
    });
    
    // Initialize monitoring state
    const monitoringState = {
      intervalId: null,
      checkInterval: this.defaultCheckInterval,
      consecutiveFailures: 0,
      backoffMultiplier: 1
    };
    
    this.monitoringStates.set(ipAddress, monitoringState);
    
    // Start the monitoring loop
    this._scheduleCheck(ipAddress);
  }

  /**
   * Stop monitoring a device
   * @param {string} ipAddress - IP address of device to stop monitoring
   */
  stopMonitoring(ipAddress) {
    const monitoringState = this.monitoringStates.get(ipAddress);
    
    if (monitoringState && monitoringState.intervalId) {
      clearTimeout(monitoringState.intervalId);
    }
    
    this.monitoringStates.delete(ipAddress);
    this.deviceStatuses.delete(ipAddress);
    this.activeChecks.delete(ipAddress);
  }

  /**
   * Get current status of all monitored devices
   * @returns {Map<string, DeviceStatus>} Map of IP addresses to device statuses
   */
  getDeviceStatuses() {
    return new Map(this.deviceStatuses);
  }

  /**
   * Register callback for status changes
   * @param {function(string, DeviceStatus): void} callback - Callback function
   */
  onStatusChange(callback) {
    this.on('statusChange', callback);
  }

  /**
   * Schedule a check for a device
   * @private
   * @param {string} ipAddress - IP address to check
   */
  _scheduleCheck(ipAddress) {
    const monitoringState = this.monitoringStates.get(ipAddress);
    
    if (!monitoringState) {
      return;
    }
    
    // Clear any existing timeout
    if (monitoringState.intervalId) {
      clearTimeout(monitoringState.intervalId);
    }
    
    // Schedule the next check
    monitoringState.intervalId = setTimeout(() => {
      this._checkDevice(ipAddress);
    }, monitoringState.checkInterval);
  }

  /**
   * Check a single device's connectivity
   * @private
   * @param {string} ipAddress - IP address to check
   */
  async _checkDevice(ipAddress) {
    // Wait if we've hit the concurrency limit
    while (this.activeChecks.size >= this.concurrencyLimit) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const monitoringState = this.monitoringStates.get(ipAddress);
    const currentStatus = this.deviceStatuses.get(ipAddress);
    
    if (!monitoringState || !currentStatus) {
      return;
    }
    
    this.activeChecks.add(ipAddress);
    
    try {
      // Perform ping check
      const pingResult = await ping.promise.probe(ipAddress, {
        timeout: 2,
        min_reply: 1
      });
      
      const now = new Date();
      const wasOnline = currentStatus.isOnline;
      const isOnline = pingResult.alive;
      const responseTime = isOnline ? parseFloat(pingResult.time) : -1;
      
      // Update status
      const newStatus = {
        ipAddress,
        isOnline,
        lastChecked: now,
        responseTime
      };
      
      this.deviceStatuses.set(ipAddress, newStatus);
      
      // Handle status change
      if (wasOnline !== isOnline) {
        this.emit('statusChange', ipAddress, newStatus);
      }
      
      // Update backoff based on result
      if (isOnline) {
        // Device is online, reset backoff
        monitoringState.consecutiveFailures = 0;
        monitoringState.backoffMultiplier = 1;
        monitoringState.checkInterval = this.defaultCheckInterval;
      } else {
        // Device is offline, apply exponential backoff
        monitoringState.consecutiveFailures++;
        monitoringState.backoffMultiplier = Math.pow(2, Math.min(monitoringState.consecutiveFailures - 1, 5));
        monitoringState.checkInterval = Math.min(
          this.defaultCheckInterval * monitoringState.backoffMultiplier,
          this.maxBackoffInterval
        );
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error(`Error checking device ${ipAddress}:`, err.message);
    } finally {
      this.activeChecks.delete(ipAddress);
      
      // Schedule next check
      this._scheduleCheck(ipAddress);
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

module.exports = StatusMonitor;
