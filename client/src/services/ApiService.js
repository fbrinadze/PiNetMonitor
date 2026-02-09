import axios from 'axios';

/**
 * API Service for Network Monitor
 * Handles all HTTP communication with the backend REST API
 */

// Base URL for API requests
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds

/**
 * Delay helper for retry logic
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry wrapper for API calls
 * @param {Function} fn - The function to retry
 * @param {number} retries - Number of retries remaining
 * @returns {Promise} - Result of the function call
 */
const withRetry = async (fn, retries = MAX_RETRIES) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      await delay(RETRY_DELAY * (MAX_RETRIES - retries + 1)); // Exponential backoff
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
};

/**
 * Determine if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
const isRetryableError = (error) => {
  if (!error.response) {
    // Network error, timeout, or no response
    return true;
  }
  // Retry on 5xx server errors
  return error.response.status >= 500 && error.response.status < 600;
};

/**
 * Fetch all discovered devices
 * @returns {Promise<Array>} - Array of device objects
 */
export const fetchDevices = async () => {
  return withRetry(async () => {
    const response = await apiClient.get('/devices');
    return response.data;
  });
};

/**
 * Trigger a new network scan
 * @returns {Promise<Object>} - Scan status object with status and estimatedTime
 */
export const triggerScan = async () => {
  return withRetry(async () => {
    const response = await apiClient.post('/devices/scan');
    return response.data;
  });
};

/**
 * Fetch current status of a specific device
 * @param {string} ip - IP address of the device
 * @returns {Promise<Object>} - Device status object
 */
export const fetchDeviceStatus = async (ip) => {
  if (!ip) {
    throw new Error('IP address is required');
  }
  return withRetry(async () => {
    const response = await apiClient.get(`/devices/${ip}/status`);
    return response.data;
  });
};

/**
 * Fetch health metrics for a specific device
 * @param {string} ip - IP address of the device
 * @returns {Promise<Object>} - Health metrics object
 */
export const fetchDeviceHealth = async (ip) => {
  if (!ip) {
    throw new Error('IP address is required');
  }
  return withRetry(async () => {
    const response = await apiClient.get(`/devices/${ip}/health`);
    return response.data;
  });
};

/**
 * Fetch current traffic statistics
 * @returns {Promise<Object>} - Current traffic stats object
 */
export const fetchCurrentTraffic = async () => {
  return withRetry(async () => {
    const response = await apiClient.get('/traffic/current');
    return response.data;
  });
};

/**
 * Fetch historical traffic data
 * @param {Date|string|number} start - Start timestamp
 * @param {Date|string|number} end - End timestamp
 * @returns {Promise<Array>} - Array of traffic stats objects
 */
export const fetchTrafficHistory = async (start, end) => {
  if (!start || !end) {
    throw new Error('Start and end timestamps are required');
  }
  
  // Convert to timestamps if Date objects
  const startTime = start instanceof Date ? start.getTime() : start;
  const endTime = end instanceof Date ? end.getTime() : end;
  
  return withRetry(async () => {
    const response = await apiClient.get('/traffic/history', {
      params: { start: startTime, end: endTime }
    });
    return response.data;
  });
};

/**
 * Fetch health metrics for all devices
 * @returns {Promise<Object>} - Map of IP addresses to health metrics
 */
export const fetchAllHealth = async () => {
  return withRetry(async () => {
    const response = await apiClient.get('/health/all');
    return response.data;
  });
};

/**
 * Fetch system information
 * @returns {Promise<Object>} - System info object with version, uptime, hostname
 */
export const fetchSystemInfo = async () => {
  return withRetry(async () => {
    const response = await apiClient.get('/system/info');
    return response.data;
  });
};

// Export the axios instance for advanced usage if needed
export { apiClient };

export default {
  fetchDevices,
  triggerScan,
  fetchDeviceStatus,
  fetchDeviceHealth,
  fetchCurrentTraffic,
  fetchTrafficHistory,
  fetchAllHealth,
  fetchSystemInfo,
};
