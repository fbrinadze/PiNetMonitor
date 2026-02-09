/**
 * Network Monitor - Main Server Entry Point
 * @module server/index
 */

const os = require('os');
const DeviceScanner = require('./components/DeviceScanner');
const StatusMonitor = require('./components/StatusMonitor');
const TrafficAnalyzer = require('./components/TrafficAnalyzer');
const HealthMonitor = require('./components/HealthMonitor');
const DataStore = require('./components/DataStore');
const { createServer } = require('./api/server');

// Configuration
const CONFIG = {
  port: 3000,
  subnet: '192.168.1',
  networkInterface: null, // Auto-detect
  scanInterval: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  dataRetentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Main application class that wires all components together
 */
class NetworkMonitorApp {
  constructor() {
    this.deviceScanner = null;
    this.statusMonitor = null;
    this.trafficAnalyzer = null;
    this.healthMonitor = null;
    this.dataStore = null;
    this.server = null;
    this.scanIntervalId = null;
    this.cleanupIntervalId = null;
    this.isRunning = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    try {
      console.log('Network Monitor Server - Initializing...');

      // Initialize DataStore and load persisted devices
      console.log('Initializing DataStore...');
      this.dataStore = new DataStore();
      await this.dataStore.initialize();
      
      const persistedDevices = await this.dataStore.getAllDevices();
      console.log(`Loaded ${persistedDevices.length} persisted devices from storage`);

      // Initialize DeviceScanner
      console.log('Initializing DeviceScanner...');
      this.deviceScanner = new DeviceScanner();
      
      // Restore cached devices from persisted data
      for (const device of persistedDevices) {
        this.deviceScanner.deviceCache.set(device.ipAddress, device);
      }

      // Initialize StatusMonitor
      console.log('Initializing StatusMonitor...');
      this.statusMonitor = new StatusMonitor();

      // Initialize TrafficAnalyzer
      console.log('Initializing TrafficAnalyzer...');
      this.trafficAnalyzer = new TrafficAnalyzer();

      // Initialize HealthMonitor
      console.log('Initializing HealthMonitor...');
      this.healthMonitor = new HealthMonitor();

      // Create REST API and WebSocket server
      console.log('Creating API server...');
      this.server = createServer({
        deviceScanner: this.deviceScanner,
        statusMonitor: this.statusMonitor,
        trafficAnalyzer: this.trafficAnalyzer,
        healthMonitor: this.healthMonitor,
        dataStore: this.dataStore
      }, {
        port: CONFIG.port
      });

      console.log('Initialization complete');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start() {
    try {
      if (this.isRunning) {
        console.warn('Application is already running');
        return;
      }

      console.log('Network Monitor Server - Starting...');

      // Start the REST API server
      await this.server.start();

      // Connect component events to WebSocket server for real-time updates
      this._setupEventHandlers();

      // Detect and start monitoring network interface
      const networkInterface = await this._detectNetworkInterface();
      if (networkInterface) {
        console.log(`Starting traffic monitoring on interface: ${networkInterface}`);
        this.trafficAnalyzer.startMonitoring(networkInterface);
      } else {
        console.warn('Could not detect network interface, traffic monitoring disabled');
      }

      // Perform initial network scan
      console.log(`Performing initial network scan on subnet ${CONFIG.subnet}.x...`);
      await this._performNetworkScan();

      // Set up periodic network scans (every 5 minutes)
      console.log(`Setting up periodic network scans (every ${CONFIG.scanInterval / 1000} seconds)`);
      this.scanIntervalId = setInterval(() => {
        this._performNetworkScan();
      }, CONFIG.scanInterval);

      // Set up automatic data cleanup (every hour)
      console.log(`Setting up automatic data cleanup (every ${CONFIG.cleanupInterval / 1000} seconds)`);
      this.cleanupIntervalId = setInterval(() => {
        this._performDataCleanup();
      }, CONFIG.cleanupInterval);

      this.isRunning = true;
      console.log('Network Monitor Server - Running');
      console.log(`Access the API at http://localhost:${CONFIG.port}/api`);
      console.log(`System hostname: ${os.hostname()}`);
    } catch (error) {
      console.error('Failed to start application:', error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop() {
    try {
      if (!this.isRunning) {
        return;
      }

      console.log('Stopping Network Monitor Server...');

      // Clear periodic tasks
      if (this.scanIntervalId) {
        clearInterval(this.scanIntervalId);
        this.scanIntervalId = null;
      }

      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
        this.cleanupIntervalId = null;
      }

      // Stop all monitoring components
      if (this.statusMonitor) {
        this.statusMonitor.stopAll();
      }

      if (this.trafficAnalyzer) {
        this.trafficAnalyzer.stopMonitoring();
      }

      if (this.healthMonitor) {
        this.healthMonitor.stopAll();
      }

      // Stop the API server
      if (this.server) {
        await this.server.stop();
      }

      // Close the data store
      if (this.dataStore) {
        await this.dataStore.close();
      }

      this.isRunning = false;
      console.log('Network Monitor Server - Stopped');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers to connect components
   * @private
   */
  _setupEventHandlers() {
    // Device Scanner events
    this.deviceScanner.on('deviceDiscovered', async (device) => {
      try {
        // Save device to data store
        await this.dataStore.saveDevice(device);

        // Start monitoring the device
        this.statusMonitor.startMonitoring(device);
        this.healthMonitor.startMonitoring(device.ipAddress);

        console.log(`Device discovered: ${device.ipAddress} (${device.hostname})`);
      } catch (error) {
        console.error(`Error handling device discovery for ${device.ipAddress}:`, error);
      }
    });

    // Status Monitor events
    this.statusMonitor.onStatusChange(async (ipAddress, status) => {
      try {
        // Update device status in data store
        const device = await this.dataStore.getDevice(ipAddress);
        if (device) {
          device.isActive = status.isOnline;
          device.lastSeen = status.lastChecked;
          await this.dataStore.saveDevice(device);
        }

        console.log(`Device status changed: ${ipAddress} - ${status.isOnline ? 'online' : 'offline'}`);
      } catch (error) {
        console.error(`Error handling status change for ${ipAddress}:`, error);
      }
    });

    // Traffic Analyzer events
    this.trafficAnalyzer.onTrafficUpdate(async (stats) => {
      try {
        // Save traffic stats to data store (with granularity control)
        // Only save every minute to avoid excessive writes
        const now = new Date();
        const lastSave = this.trafficAnalyzer.lastHistorySave;
        
        if (!lastSave || (now.getTime() - lastSave.getTime()) >= 60000) {
          await this.dataStore.saveTrafficStats(stats);
        }
      } catch (error) {
        console.error('Error saving traffic stats:', error);
      }
    });

    // Health Monitor events
    this.healthMonitor.onHealthUpdate(async (ipAddress, metrics) => {
      try {
        // Save health metrics to data store
        await this.dataStore.saveHealthMetrics(metrics);

        if (metrics.isDegraded) {
          console.warn(`Device health degraded: ${ipAddress} - Latency: ${metrics.latency.toFixed(2)}ms, Packet Loss: ${metrics.packetLoss.toFixed(2)}%`);
        }
      } catch (error) {
        console.error(`Error saving health metrics for ${ipAddress}:`, error);
      }
    });
  }

  /**
   * Perform a network scan
   * @private
   */
  async _performNetworkScan() {
    try {
      console.log(`Starting network scan on ${CONFIG.subnet}.x...`);
      const startTime = Date.now();
      
      const devices = await this.deviceScanner.scanNetwork(CONFIG.subnet);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Network scan complete: ${devices.length} devices found in ${duration}s`);
    } catch (error) {
      console.error('Error during network scan:', error);
    }
  }

  /**
   * Perform automatic data cleanup
   * @private
   */
  async _performDataCleanup() {
    try {
      const cutoffDate = new Date(Date.now() - CONFIG.dataRetentionPeriod);
      console.log(`Cleaning up data older than ${cutoffDate.toISOString()}...`);
      
      await this.dataStore.cleanupOldData(cutoffDate);
      
      console.log('Data cleanup complete');
    } catch (error) {
      console.error('Error during data cleanup:', error);
    }
  }

  /**
   * Detect the primary network interface
   * @private
   * @returns {Promise<string|null>} Network interface name or null
   */
  async _detectNetworkInterface() {
    try {
      const networkInterfaces = os.networkInterfaces();
      
      // Priority order: eth0, wlan0, en0, any other non-loopback interface
      const priorityInterfaces = ['eth0', 'wlan0', 'en0'];
      
      // Check priority interfaces first
      for (const ifaceName of priorityInterfaces) {
        if (networkInterfaces[ifaceName]) {
          const iface = networkInterfaces[ifaceName].find(i => i.family === 'IPv4' && !i.internal);
          if (iface) {
            return ifaceName;
          }
        }
      }
      
      // Fall back to any non-loopback interface
      for (const [ifaceName, addresses] of Object.entries(networkInterfaces)) {
        const iface = addresses.find(i => i.family === 'IPv4' && !i.internal);
        if (iface) {
          return ifaceName;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting network interface:', error);
      return null;
    }
  }
}

// Create and start the application
const app = new NetworkMonitorApp();

// Initialize and start
app.initialize()
  .then(() => app.start())
  .catch(error => {
    console.error('Failed to start Network Monitor:', error);
    process.exit(1);
  });

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  try {
    await app.stop();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  try {
    await app.stop();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
