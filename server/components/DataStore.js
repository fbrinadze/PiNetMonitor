const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * DataStore class for persisting device information and historical data
 * Uses JSON file storage with write-ahead logging pattern
 */
class DataStore {
  constructor(dataDir = null) {
    // Default to ~/.network-monitor/ directory
    this.dataDir = dataDir || path.join(os.homedir(), '.network-monitor');
    this.dbPath = path.join(this.dataDir, 'db.json');
    this.data = {
      devices: [],
      trafficStats: [],
      healthMetrics: []
    };
    this.initialized = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Initialize the database and create directory if needed
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });

      // Try to read existing data
      try {
        const fileContent = await fs.readFile(this.dbPath, 'utf8');
        const parsedData = JSON.parse(fileContent);
        
        // Validate structure
        if (parsedData && typeof parsedData === 'object') {
          this.data = {
            devices: parsedData.devices || [],
            trafficStats: parsedData.trafficStats || [],
            healthMetrics: parsedData.healthMetrics || []
          };
        }
      } catch (error) {
        // File doesn't exist or is corrupted, use default empty structure
        if (error.code !== 'ENOENT') {
          // Log corrupted data but continue with empty structure
          console.warn(`DataStore: Could not read existing data: ${error.message}`);
        }
        // Initialize with empty data
        await this._write();
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize DataStore: ${error.message}`);
    }
  }

  /**
   * Write data to disk with atomic write pattern and write queue
   */
  async _write() {
    // Queue writes to prevent concurrent write conflicts
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.dbPath}.tmp`;
      
      try {
        // Write to temporary file first
        await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
        
        // Atomically rename to actual file
        await fs.rename(tempPath, this.dbPath);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch (unlinkError) {
          // Ignore unlink errors
        }
        throw error;
      }
    });
    
    return this.writeQueue;
  }

  /**
   * Ensure database is initialized before operations
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ==================== Device CRUD Operations ====================

  /**
   * Save a device to storage
   * @param {Object} device - Device object to save
   */
  async saveDevice(device) {
    await this._ensureInitialized();

    const existingIndex = this.data.devices.findIndex(d => d.ipAddress === device.ipAddress);

    if (existingIndex >= 0) {
      // Update existing device
      this.data.devices[existingIndex] = { ...this.data.devices[existingIndex], ...device };
    } else {
      // Add new device
      this.data.devices.push(device);
    }

    await this._write();
  }

  /**
   * Get a device by IP address
   * @param {string} ipAddress - IP address of the device
   * @returns {Object|null} Device object or null if not found
   */
  async getDevice(ipAddress) {
    await this._ensureInitialized();

    const device = this.data.devices.find(d => d.ipAddress === ipAddress);
    return device || null;
  }

  /**
   * Get all devices
   * @returns {Array} Array of all devices
   */
  async getAllDevices() {
    await this._ensureInitialized();

    return [...this.data.devices];
  }

  /**
   * Delete a device by IP address
   * @param {string} ipAddress - IP address of the device to delete
   */
  async deleteDevice(ipAddress) {
    await this._ensureInitialized();

    const initialLength = this.data.devices.length;
    this.data.devices = this.data.devices.filter(d => d.ipAddress !== ipAddress);

    if (this.data.devices.length < initialLength) {
      await this._write();
    }
  }

  // ==================== Traffic Stats Operations ====================

  /**
   * Save traffic statistics
   * @param {Object} stats - Traffic statistics object
   */
  async saveTrafficStats(stats) {
    await this._ensureInitialized();

    this.data.trafficStats.push({
      ...stats,
      timestamp: stats.timestamp instanceof Date ? stats.timestamp.toISOString() : stats.timestamp
    });

    await this._write();
  }

  /**
   * Get traffic statistics within a time range
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Array} Array of traffic statistics
   */
  async getTrafficStats(startTime, endTime) {
    await this._ensureInitialized();

    const start = startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime();
    const end = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();

    return this.data.trafficStats
      .filter(stat => {
        const timestamp = new Date(stat.timestamp).getTime();
        return timestamp >= start && timestamp <= end;
      })
      .map(stat => ({
        ...stat,
        timestamp: new Date(stat.timestamp)
      }));
  }

  // ==================== Health Metrics Operations ====================

  /**
   * Save health metrics for a device
   * @param {Object} metrics - Health metrics object
   */
  async saveHealthMetrics(metrics) {
    await this._ensureInitialized();

    this.data.healthMetrics.push({
      ...metrics,
      lastUpdated: metrics.lastUpdated instanceof Date ? metrics.lastUpdated.toISOString() : metrics.lastUpdated
    });

    await this._write();
  }

  /**
   * Get health metrics for a specific device within a time range
   * @param {string} ipAddress - IP address of the device
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Array} Array of health metrics
   */
  async getHealthMetrics(ipAddress, startTime, endTime) {
    await this._ensureInitialized();

    const start = startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime();
    const end = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime();

    return this.data.healthMetrics
      .filter(metric => {
        const timestamp = new Date(metric.lastUpdated).getTime();
        return metric.ipAddress === ipAddress && timestamp >= start && timestamp <= end;
      })
      .map(metric => ({
        ...metric,
        lastUpdated: new Date(metric.lastUpdated)
      }));
  }

  // ==================== Cleanup Operations ====================

  /**
   * Remove data older than specified date
   * @param {Date} olderThan - Date threshold for cleanup
   */
  async cleanupOldData(olderThan) {
    await this._ensureInitialized();

    const threshold = olderThan instanceof Date ? olderThan.getTime() : new Date(olderThan).getTime();

    // Clean up traffic stats
    const initialTrafficCount = this.data.trafficStats.length;
    this.data.trafficStats = this.data.trafficStats.filter(stat => {
      const timestamp = new Date(stat.timestamp).getTime();
      return timestamp >= threshold;
    });

    // Clean up health metrics
    const initialHealthCount = this.data.healthMetrics.length;
    this.data.healthMetrics = this.data.healthMetrics.filter(metric => {
      const timestamp = new Date(metric.lastUpdated).getTime();
      return timestamp >= threshold;
    });

    // Only write if data was actually removed
    if (this.data.trafficStats.length < initialTrafficCount || 
        this.data.healthMetrics.length < initialHealthCount) {
      await this._write();
    }
  }

  /**
   * Get the current database state (for testing/debugging)
   * @returns {Object} Current database data
   */
  async getState() {
    await this._ensureInitialized();
    return { ...this.data };
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.initialized) {
      await this._write();
    }
    this.initialized = false;
  }
}

module.exports = DataStore;
