import React, { useState, useEffect, useCallback, useRef } from 'react';
import webSocketService from './services/WebSocketService';
import {
  fetchDevices,
  fetchCurrentTraffic,
  fetchAllHealth,
} from './services/ApiService';
import Dashboard from './components/Dashboard';
import ErrorMessage from './components/ErrorMessage';
import ConnectionStatus from './components/ConnectionStatus';

/**
 * Root App component for Network Monitor
 * Manages application state and real-time data updates
 */
function App() {
  // State management
  /** @type {[Array<any>, Function]} */
  const [devices, setDevices] = useState([]);
  /** @type {[any, Function]} */
  const [trafficStats, setTrafficStats] = useState(null);
  /** @type {[Map<string, any>, Function]} */
  const [healthMetrics, setHealthMetrics] = useState(new Map());
  /** @type {[boolean, Function]} */
  const [isConnected, setIsConnected] = useState(false);
  /** @type {[string | null, Function]} */
  const [error, setError] = useState(null);
  /** @type {[boolean, Function]} */
  const [isLoading, setIsLoading] = useState(true);

  // Polling fallback
  /** @type {React.MutableRefObject<NodeJS.Timeout | null>} */
  const pollingIntervalRef = useRef(null);
  /** @type {React.MutableRefObject<boolean>} */
  const wsFailedRef = useRef(false);

  /**
   * Load initial data from API
   */
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all initial data in parallel
      const [devicesData, trafficData, healthData] = await Promise.all([
        fetchDevices(),
        fetchCurrentTraffic(),
        fetchAllHealth(),
      ]);

      setDevices(devicesData);
      setTrafficStats(trafficData);
      
      // Convert health data object to Map
      const healthMap = new Map(Object.entries(healthData));
      setHealthMetrics(healthMap);

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      
      // Check if it's a network error (backend unavailable)
      const isNetworkError = err.message?.includes('Network Error') || 
                            err.message?.includes('ECONNREFUSED') ||
                            err.code === 'ECONNREFUSED';
      
      if (isNetworkError) {
        setError('Unable to connect to the backend server. Please ensure the server is running at http://localhost:3000');
      } else {
        setError('Failed to load initial data. Retrying...');
      }
      
      setIsLoading(false);
      
      // Retry after 3 seconds
      setTimeout(loadInitialData, 3000);
    }
  }, []);

  /**
   * Start polling fallback when WebSocket fails
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return; // Already polling
    }

    console.log('Starting polling fallback');
    wsFailedRef.current = true;

    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const [devicesData, trafficData, healthData] = await Promise.all([
          fetchDevices(),
          fetchCurrentTraffic(),
          fetchAllHealth(),
        ]);

        setDevices(devicesData);
        setTrafficStats(trafficData);
        
        const healthMap = new Map(Object.entries(healthData));
        setHealthMetrics(healthMap);
      } catch (err) {
        console.error('Polling failed:', err);
      }
    }, 5000);
  }, []);

  /**
   * Stop polling fallback
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Stopped polling fallback');
    }
  }, []);

  /**
   * Initialize WebSocket connection and subscriptions
   */
  useEffect(() => {
    const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3000';

    // Connect to WebSocket
    webSocketService.connect(WS_URL);

    // Handle connection status changes
    const handleConnectionStatus = ({ connected }) => {
      setIsConnected(connected);
      
      if (connected) {
        console.log('WebSocket connected');
        wsFailedRef.current = false;
        stopPolling();
      } else {
        console.log('WebSocket disconnected');
      }
    };

    // Handle connection errors
    const handleConnectionError = ({ error }) => {
      console.error('WebSocket connection error:', error);
      setError(`Connection error: ${error}`);
    };

    // Handle connection failures (max retries reached)
    const handleConnectionFailed = () => {
      console.error('WebSocket connection failed after max retries');
      setError('Real-time connection failed. Using polling fallback.');
      startPolling();
    };

    // Handle device discovered events
    const handleDeviceDiscovered = ({ device }) => {
      setDevices(prevDevices => {
        // Check if device already exists
        const existingIndex = prevDevices.findIndex(d => d.ipAddress === device.ipAddress);
        if (existingIndex >= 0) {
          // Update existing device
          const newDevices = [...prevDevices];
          newDevices[existingIndex] = device;
          return newDevices;
        } else {
          // Add new device
          return [...prevDevices, device];
        }
      });
    };

    // Handle device status changes
    const handleDeviceStatus = ({ ipAddress, status }) => {
      setDevices(prevDevices => {
        return prevDevices.map(device => {
          if (device.ipAddress === ipAddress) {
            return {
              ...device,
              isActive: status.isOnline,
              lastSeen: status.lastChecked,
            };
          }
          return device;
        });
      });
    };

    // Handle traffic updates
    const handleTrafficUpdate = ({ stats }) => {
      setTrafficStats(stats);
    };

    // Handle health updates
    const handleHealthUpdate = ({ ipAddress, metrics }) => {
      setHealthMetrics(prevMetrics => {
        const newMetrics = new Map(prevMetrics);
        newMetrics.set(ipAddress, metrics);
        return newMetrics;
      });
    };

    // Handle scan complete events
    const handleScanComplete = ({ deviceCount }) => {
      console.log(`Network scan complete. Found ${deviceCount} devices.`);
      // Refresh device list
      fetchDevices().then(setDevices).catch(console.error);
    };

    // Subscribe to all events
    webSocketService.subscribe('connection:status', handleConnectionStatus);
    webSocketService.subscribe('connection:error', handleConnectionError);
    webSocketService.subscribe('connection:failed', handleConnectionFailed);
    webSocketService.subscribe('device:discovered', handleDeviceDiscovered);
    webSocketService.subscribe('device:status', handleDeviceStatus);
    webSocketService.subscribe('traffic:update', handleTrafficUpdate);
    webSocketService.subscribe('health:update', handleHealthUpdate);
    webSocketService.subscribe('scan:complete', handleScanComplete);

    // Cleanup on unmount
    return () => {
      webSocketService.unsubscribe('connection:status', handleConnectionStatus);
      webSocketService.unsubscribe('connection:error', handleConnectionError);
      webSocketService.unsubscribe('connection:failed', handleConnectionFailed);
      webSocketService.unsubscribe('device:discovered', handleDeviceDiscovered);
      webSocketService.unsubscribe('device:status', handleDeviceStatus);
      webSocketService.unsubscribe('traffic:update', handleTrafficUpdate);
      webSocketService.unsubscribe('health:update', handleHealthUpdate);
      webSocketService.unsubscribe('scan:complete', handleScanComplete);
      
      webSocketService.disconnect();
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  /**
   * Load initial data on mount
   */
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Render loading state
  if (isLoading && !error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading network data...</p>
        </div>
      </div>
    );
  }

  // Render error state when backend is unavailable
  if (error && devices.length === 0 && !trafficStats) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Backend Server Unavailable
          </h2>
          
          <p className="text-gray-600 text-center mb-4">
            {error}
          </p>

          <div className="bg-gray-50 rounded p-3 mb-4">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Troubleshooting:</strong>
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Ensure the backend server is running</li>
              <li>Check that the server is accessible at port 3000</li>
              <li>Verify network connectivity</li>
            </ul>
          </div>

          <button
            onClick={() => {
              setError(null);
              loadInitialData();
            }}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Network Monitor</h1>
            
            {/* Connection Status Component */}
            <ConnectionStatus 
              isConnected={isConnected}
              isPolling={wsFailedRef.current}
              error={isConnected ? null : error}
            />
          </div>
        </div>
      </header>

      {/* Error Message Component */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <ErrorMessage 
            message={error}
            type={isConnected ? 'info' : 'warning'}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Dashboard 
          devices={devices}
          trafficStats={trafficStats}
          healthMetrics={healthMetrics}
        />
      </main>
    </div>
  );
}

export default App;
