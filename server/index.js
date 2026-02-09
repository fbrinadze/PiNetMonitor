/**
 * Network Monitor - Main Server Entry Point
 * @module server/index
 */

const DeviceScanner = require('./components/DeviceScanner');
const StatusMonitor = require('./components/StatusMonitor');
const TrafficAnalyzer = require('./components/TrafficAnalyzer');
const HealthMonitor = require('./components/HealthMonitor');
const DataStore = require('./components/DataStore');
const { createServer } = require('./api/server');

console.log('Network Monitor Server - Starting...');

// Initialize components
const deviceScanner = new DeviceScanner();
const statusMonitor = new StatusMonitor();
const trafficAnalyzer = new TrafficAnalyzer();
const healthMonitor = new HealthMonitor();
const dataStore = new DataStore();

// Create and start the REST API server
const server = createServer({
  deviceScanner,
  statusMonitor,
  trafficAnalyzer,
  healthMonitor,
  dataStore
}, {
  port: 3000
});

// Start the server
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  try {
    await server.stop();
    statusMonitor.stopAll();
    trafficAnalyzer.stopMonitoring();
    healthMonitor.stopAll();
    await dataStore.close();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down...');
  try {
    await server.stop();
    statusMonitor.stopAll();
    trafficAnalyzer.stopMonitoring();
    healthMonitor.stopAll();
    await dataStore.close();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});
