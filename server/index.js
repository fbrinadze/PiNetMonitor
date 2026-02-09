/**
 * Network Monitor - Main Server Entry Point
 * @module server/index
 */

// Load environment variables
require('dotenv').config();

const os = require('os');
const DeviceScanner = require('./components/DeviceScanner');
const StatusMonitor = require('./components/StatusMonitor');
const TrafficAnalyzer = require('./components/TrafficAnalyzer');
const HealthMonitor = require('./components/HealthMonitor');
const DataStore = require('./components/DataStore');
const { createServer } = require('./api/server');
const logger = require('./config/logger');

// Configuration from environment variables
const CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  subnet: process.env.SUBNET || '192.168.1',
  networkInterface: process.env.NETWORK_INTERFACE || null, // Auto-detect if not specified
  scanInterval: parseInt(process.env.SCAN_INTERVAL || '300000', 10), // 5 minutes
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  dataRetentionPeriod: parseInt(process.env.DATA_RETENTION_HOURS || '24', 10) * 60 * 60 * 1000
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
      logger.info('Network Monitor Server - Initializing...');

      // Initialize DataStore and load persisted devices
      logger.info('Initializing DataStore...');
      this.dataStore = new DataStore();
      await this.dataStore.initialize();
      
      const persistedDevices = await this.dataStore.getAllDevices();
      logger.info(`Loaded ${persistedDevices.length} persisted devices from storage`);

      // Initialize DeviceScanner
      logger.info('Initializing DeviceScanner...');
      this.deviceScanner = new DeviceScanner();
      
      // Restore cached devices from persisted data
      for (const device of persistedDevices) {
        this.deviceScanner.deviceCache.set(device.ipAddress, device);
      }

      // Initialize StatusMonitor
      logger.info('Initializing StatusMonitor...');
      this.statusMonitor = new StatusMonitor();

      // Initialize TrafficAnalyzer
      logger.info('Initializing TrafficAnalyzer...');
      this.trafficAnalyzer = new TrafficAnalyzer();

      // Initialize HealthMonitor
      logger.info('Initializing HealthMonitor...');
      this.healthMonitor = new HealthMonitor();

      // Create REST API and WebSocket server
      logger.info('Creating API server...');
      this.server = createServer({
        deviceScanner: this.deviceScanner,
        statusMonitor: this.statusMonitor,
        trafficAnalyzer: this.trafficAnalyzer,
        healthMonitor: this.healthMonitor,
        dataStore: this.dataStore
      }, {
        port: CONFIG.port
      });

      logger.info('Initialization complete');
    } catch (error) {
      logger.logError(error, { context: 'Application initialization' });
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Application is already running');
        return;
      }

      logger.info('Network Monitor Server - Starting...');
      logger.info(`Configuration: Port=${CONFIG.port}, Subnet=${CONFIG.subnet}.x, ScanInterval=${CONFIG.scanInterval}ms`);

      // Start the REST API server
      await this.server.start();

      // Connect component events to WebSocket server for real-time updates
      this._setupEventHandlers();

      // Detect and start monitoring network interface
      const networkInterface = CONFIG.networkInterface || await this._detectNetworkInterface();
      if (networkInterface) {
        logger.info(`Starting traffic monitoring on interface: ${networkInterface}`);
        this.trafficAnalyzer.startMonitoring(networkInterface);
      } else {
        logger.warn('Could not detect network interface, traffic monitoring disabled');
      }

      // Perform initial network scan
      logger.info(`Performing initial network scan on subnet ${CONFIG.subnet}.x...`);
      await this._performNetworkScan();

      // Set up periodic network scans
      logger.info(`Setting up periodic network scans (every ${CONFIG.scanInterval / 1000} seconds)`);
      this.scanIntervalId = setInterval(() => {
        this._performNetworkScan();
      }, CONFIG.scanInterval);

      // Set up automatic data cleanup
      logger.info(`Setting up automatic data cleanup (every ${CONFIG.cleanupInterval / 1000} seconds)`);
      this.cleanupIntervalId = setInterval(() => {
        this._performDataCleanup();
      }, CONFIG.cleanupInterval);

      this.isRunning = true;
      logger.info('Network Monitor Server - Running');
      logger.info(`Access the API at http://localhost:${CONFIG.port}/api`);
      logger.info(`System hostname: ${os.hostname()}`);
    } catch (error) {
      logger.logError(error, { context: 'Application startup' });
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

      logger.info('Stopping Network Monitor Server...');

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
      logger.info('Network Monitor Server - Stopped');
    } catch (error) {
      logger.logError(error, { context: 'Application shutdown' });
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

        logger.logDeviceEvent('discovered', device);
      } catch (error) {
        logger.logError(error, { context: 'Device discovery', ipAddress: device.ipAddress });
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

        logger.logNetworkEvent('status_change', { 
          ipAddress, 
          status: status.isOnline ? 'online' : 'offline',
          responseTime: status.responseTime
        });
      } catch (error) {
        logger.logError(error, { context: 'Status change', ipAddress });
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
        logger.logError(error, { context: 'Traffic stats save' });
      }
    });

    // Health Monitor events
    this.healthMonitor.onHealthUpdate(async (ipAddress, metrics) => {
      try {
        // Save health metrics to data store
        await this.dataStore.saveHealthMetrics(metrics);

        if (metrics.isDegraded) {
          logger.warn(`Device health degraded: ${ipAddress}`, {
            latency: metrics.latency.toFixed(2),
            packetLoss: metrics.packetLoss.toFixed(2)
          });
        }
      } catch (error) {
        logger.logError(error, { context: 'Health metrics save', ipAddress });
      }
    });
  }

  /**
   * Perform a network scan
   * @private
   */
  async _performNetworkScan() {
    try {
      logger.info(`Starting network scan on ${CONFIG.subnet}.x...`);
      const startTime = Date.now();
      
      const devices = await this.deviceScanner.scanNetwork(CONFIG.subnet);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.logPerformance('network_scan', duration, { deviceCount: devices.length });
    } catch (error) {
      logger.logError(error, { context: 'Network scan' });
    }
  }

  /**
   * Perform automatic data cleanup
   * @private
   */
  async _performDataCleanup() {
    try {
      const cutoffDate = new Date(Date.now() - CONFIG.dataRetentionPeriod);
      logger.info(`Cleaning up data older than ${cutoffDate.toISOString()}...`);
      
      await this.dataStore.cleanupOldData(cutoffDate);
      
      logger.info('Data cleanup complete');
    } catch (error) {
      logger.logError(error, { context: 'Data cleanup' });
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
      logger.logError(error, { context: 'Network interface detection' });
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
    logger.logError(error, { context: 'Application startup' });
    process.exit(1);
  });

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    await app.stop();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.logError(error, { context: 'SIGINT shutdown' });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    await app.stop();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.logError(error, { context: 'SIGTERM shutdown' });
    process.exit(1);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.logError(error, { context: 'Uncaught exception' });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});
