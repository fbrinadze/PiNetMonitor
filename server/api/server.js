/**
 * REST API Server for Network Monitor
 * @module server/api/server
 */

const express = require('express');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

/**
 * Create and configure the Express REST API server
 * @param {Object} components - Backend components
 * @param {Object} components.deviceScanner - DeviceScanner instance
 * @param {Object} components.statusMonitor - StatusMonitor instance
 * @param {Object} components.trafficAnalyzer - TrafficAnalyzer instance
 * @param {Object} components.healthMonitor - HealthMonitor instance
 * @param {Object} components.dataStore - DataStore instance
 * @param {Object} options - Server options
 * @param {number} [options.port=3000] - Port to listen on
 * @returns {Object} Express app and server control functions
 */
function createServer(components, options = {}) {
  const {
    deviceScanner,
    statusMonitor,
    trafficAnalyzer,
    healthMonitor,
    dataStore
  } = components;

  const port = options.port || 3000;
  const app = express();

  // Middleware
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
  });

  // ==================== API Endpoints ====================

  /**
   * GET /api/devices
   * Returns all discovered devices
   */
  app.get('/api/devices', async (req, res, next) => {
    try {
      const devices = await dataStore.getAllDevices();
      res.json(devices);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/devices/scan
   * Trigger a new network scan
   */
  app.post('/api/devices/scan', async (req, res, next) => {
    try {
      // Start scan asynchronously
      const subnet = req.body.subnet || '192.168.1';
      
      // Estimate time based on 254 devices with ~2 second timeout each
      // With parallel scanning, should complete in ~60 seconds
      const estimatedTime = 60000;

      // Trigger scan in background
      setImmediate(async () => {
        try {
          await deviceScanner.scanNetwork(subnet);
        } catch (error) {
          console.error('Background scan error:', error);
        }
      });

      res.json({
        status: 'started',
        estimatedTime
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/devices/:ip/status
   * Get current status of a specific device
   */
  app.get('/api/devices/:ip/status', async (req, res, next) => {
    try {
      const ipAddress = req.params.ip;
      const statuses = statusMonitor.getDeviceStatuses();
      const status = statuses.get(ipAddress);

      if (!status) {
        return res.status(404).json({
          error: 'Device not found',
          message: `No status information available for device ${ipAddress}`,
          availableDevices: Array.from(statuses.keys())
        });
      }

      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/devices/:ip/health
   * Get health metrics for a specific device
   */
  app.get('/api/devices/:ip/health', async (req, res, next) => {
    try {
      const ipAddress = req.params.ip;
      const metrics = healthMonitor.getHealthMetrics(ipAddress);

      if (!metrics) {
        const allMetrics = healthMonitor.getAllHealthMetrics();
        return res.status(404).json({
          error: 'Device not found',
          message: `No health metrics available for device ${ipAddress}`,
          availableDevices: Array.from(allMetrics.keys())
        });
      }

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/traffic/current
   * Get current traffic statistics
   */
  app.get('/api/traffic/current', (req, res, next) => {
    try {
      const stats = trafficAnalyzer.getCurrentStats();

      if (!stats) {
        return res.json({
          message: 'Traffic monitoring not yet initialized',
          timestamp: new Date(),
          bytesReceived: 0,
          bytesSent: 0,
          bytesReceivedPerSec: 0,
          bytesSentPerSec: 0,
          packetsReceived: 0,
          packetsSent: 0
        });
      }

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/traffic/history
   * Get historical traffic data
   * Query parameters: start (ISO timestamp), end (ISO timestamp)
   */
  app.get('/api/traffic/history', async (req, res, next) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Both start and end query parameters are required',
          example: '/api/traffic/history?start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z'
        });
      }

      const startTime = new Date(start);
      const endTime = new Date(end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T00:00:00Z)'
        });
      }

      const historicalStats = trafficAnalyzer.getHistoricalStats(startTime, endTime);
      res.json(historicalStats);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/health/all
   * Get health metrics for all devices
   */
  app.get('/api/health/all', (req, res, next) => {
    try {
      const allMetrics = healthMonitor.getAllHealthMetrics();
      
      // Convert Map to object for JSON serialization
      const metricsObject = {};
      for (const [ip, metrics] of allMetrics.entries()) {
        metricsObject[ip] = metrics;
      }

      res.json(metricsObject);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/system/info
   * Get system information
   */
  app.get('/api/system/info', (req, res, next) => {
    try {
      const info = {
        version: '1.0.0',
        uptime: process.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        cpus: os.cpus().length
      };

      res.json(info);
    } catch (error) {
      next(error);
    }
  });

  // ==================== Error Handling Middleware ====================

  /**
   * 404 handler for undefined routes
   */
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      availableEndpoints: [
        'GET /api/devices',
        'POST /api/devices/scan',
        'GET /api/devices/:ip/status',
        'GET /api/devices/:ip/health',
        'GET /api/traffic/current',
        'GET /api/traffic/history',
        'GET /api/health/all',
        'GET /api/system/info'
      ]
    });
  });

  /**
   * Global error handler
   */
  app.use((err, req, res, next) => {
    console.error('Error handling request:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : err.name || 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: req.url
    });
  });

  // ==================== Server Control ====================

  let server = null;
  let wss = null;

  // Track client subscriptions
  const clientSubscriptions = new WeakMap();

  /**
   * Initialize WebSocket server
   * @param {Object} httpServer - HTTP server instance
   */
  function initializeWebSocket(httpServer) {
    wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      // Initialize subscription tracking for this client
      const subscriptions = new Set();
      clientSubscriptions.set(ws, subscriptions);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format. Expected JSON.',
            timestamp: new Date().toISOString()
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        clientSubscriptions.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Network Monitor WebSocket server',
        timestamp: new Date().toISOString()
      }));
    });

    // Set up event listeners for backend components
    setupComponentEventListeners();
  }

  /**
   * Handle incoming WebSocket messages
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Parsed message data
   */
  function handleWebSocketMessage(ws, data) {
    const { type, channel } = data;
    const subscriptions = clientSubscriptions.get(ws);

    if (!subscriptions) {
      return;
    }

    switch (type) {
      case 'subscribe:devices':
        subscriptions.add('devices');
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: 'devices',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'subscribe:traffic':
        subscriptions.add('traffic');
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: 'traffic',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'subscribe:health':
        subscriptions.add('health');
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: 'health',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'unsubscribe:devices':
        subscriptions.delete('devices');
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          channel: 'devices',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'unsubscribe:traffic':
        subscriptions.delete('traffic');
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          channel: 'traffic',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'unsubscribe:health':
        subscriptions.delete('health');
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          channel: 'health',
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${type}`,
          timestamp: new Date().toISOString()
        }));
    }
  }

  /**
   * Broadcast message to subscribed clients
   * @param {string} channel - Subscription channel
   * @param {Object} message - Message to broadcast
   */
  function broadcast(channel, message) {
    if (!wss) {
      return;
    }

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const subscriptions = clientSubscriptions.get(client);
        if (subscriptions && subscriptions.has(channel)) {
          client.send(JSON.stringify(message));
        }
      }
    });
  }

  /**
   * Set up event listeners for backend components
   */
  function setupComponentEventListeners() {
    // Device Scanner events
    if (deviceScanner && deviceScanner.on) {
      deviceScanner.on('deviceDiscovered', (device) => {
        broadcast('devices', {
          type: 'device:discovered',
          device,
          timestamp: new Date().toISOString()
        });
      });

      deviceScanner.on('scanComplete', (deviceCount) => {
        broadcast('devices', {
          type: 'scan:complete',
          deviceCount,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Status Monitor events
    if (statusMonitor && statusMonitor.onStatusChange) {
      statusMonitor.onStatusChange((ipAddress, status) => {
        broadcast('devices', {
          type: 'device:status',
          ipAddress,
          status,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Traffic Analyzer events
    if (trafficAnalyzer && trafficAnalyzer.onTrafficUpdate) {
      trafficAnalyzer.onTrafficUpdate((stats) => {
        broadcast('traffic', {
          type: 'traffic:update',
          stats,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Health Monitor events
    if (healthMonitor && healthMonitor.onHealthUpdate) {
      healthMonitor.onHealthUpdate((ipAddress, metrics) => {
        broadcast('health', {
          type: 'health:update',
          ipAddress,
          metrics,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  /**
   * Start the server
   * @returns {Promise<Object>} Server instance
   */
  function start() {
    return new Promise((resolve, reject) => {
      try {
        server = app.listen(port, () => {
          console.log(`Network Monitor API server listening on port ${port}`);
          console.log(`Access the API at http://localhost:${port}/api`);
          
          // Initialize WebSocket server
          initializeWebSocket(server);
          console.log(`WebSocket server initialized on port ${port}`);
          
          resolve(server);
        });

        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use`);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   * @returns {Promise<void>}
   */
  function stop() {
    return new Promise((resolve, reject) => {
      // Close WebSocket server first
      if (wss) {
        wss.clients.forEach((client) => {
          client.close();
        });
        wss.close(() => {
          console.log('WebSocket server stopped');
          wss = null;
        });
      }

      if (!server) {
        resolve();
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log('API server stopped');
          server = null;
          resolve();
        }
      });
    });
  }

  return {
    app,
    start,
    stop,
    broadcast // Expose broadcast for testing
  };
}

module.exports = { createServer };
