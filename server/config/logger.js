const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Get configuration from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: NODE_ENV === 'production' ? logFormat : consoleFormat,
    level: LOG_LEVEL
  })
);

// File transports (production only)
if (NODE_ENV === 'production') {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format: logFormat,
      level: LOG_LEVEL,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false
});

// Add helper methods for structured logging
logger.logDeviceEvent = (event, device, metadata = {}) => {
  logger.info('Device event', {
    event,
    ipAddress: device.ipAddress,
    macAddress: device.macAddress,
    hostname: device.hostname,
    ...metadata
  });
};

logger.logNetworkEvent = (event, metadata = {}) => {
  logger.info('Network event', {
    event,
    ...metadata
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.debug('Performance metric', {
    operation,
    duration,
    ...metadata
  });
};

// Handle uncaught exceptions and unhandled rejections
if (NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  );
}

module.exports = logger;
