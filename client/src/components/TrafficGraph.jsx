import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchTrafficHistory } from '../services/ApiService';

/**
 * Format bytes to human-readable format (KB/MB/GB)
 * @param {number} bytes - Bytes value
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted string
 */
const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
};

/**
 * Format timestamp for chart display
 * @param {string|number} timestamp - Timestamp to format
 * @returns {string} - Formatted time string
 */
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * Custom tooltip component for the chart
 * @param {Object} props
 * @param {boolean} props.active - Whether tooltip is active
 * @param {Array} props.payload - Data payload for tooltip
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="text-sm font-semibold text-gray-700 mb-2">
          {new Date(data.timestamp).toLocaleString()}
        </p>
        <div className="space-y-1">
          <p className="text-sm text-green-600">
            <span className="font-medium">Download:</span> {formatBytes(data.bytesReceivedPerSec)}
          </p>
          <p className="text-sm text-blue-600">
            <span className="font-medium">Upload:</span> {formatBytes(data.bytesSentPerSec)}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * TrafficGraph Component
 * Displays network traffic over time using a line chart
 * 
 * @param {Object} props
 * @param {Object} props.trafficStats - Current traffic statistics (for real-time updates)
 */
function TrafficGraph({ trafficStats }) {
  // Time range options in milliseconds
  const TIME_RANGES = {
    '1h': { label: '1 Hour', ms: 60 * 60 * 1000 },
    '6h': { label: '6 Hours', ms: 6 * 60 * 60 * 1000 },
    '24h': { label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
  };

  const [selectedRange, setSelectedRange] = useState('1h');
  /** @type {[Array<any>, Function]} */
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  /** @type {[string | null, Function]} */
  const [error, setError] = useState(null);

  /**
   * Load historical traffic data based on selected time range
   */
  const loadHistoricalData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const endTime = Date.now();
      const startTime = endTime - TIME_RANGES[selectedRange].ms;

      const data = await fetchTrafficHistory(startTime, endTime);
      setHistoricalData(data);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load traffic history:', err);
      setError('Failed to load traffic history');
      setIsLoading(false);
    }
  };

  /**
   * Load data when component mounts or time range changes
   */
  useEffect(() => {
    loadHistoricalData();
    
    // Refresh data every minute
    const interval = setInterval(loadHistoricalData, 60000);
    
    return () => clearInterval(interval);
  }, [selectedRange]);

  /**
   * Update chart data with real-time traffic stats
   * Append new data point and maintain time window
   */
  useEffect(() => {
    if (trafficStats && historicalData.length > 0) {
      setHistoricalData(prevData => {
        // Check if this is a new data point (different timestamp)
        const lastTimestamp = prevData[prevData.length - 1]?.timestamp;
        const newTimestamp = trafficStats.timestamp;
        
        if (lastTimestamp === newTimestamp) {
          // Update existing data point
          const newData = [...prevData];
          newData[newData.length - 1] = trafficStats;
          return newData;
        } else {
          // Add new data point
          const newData = [...prevData, trafficStats];
          
          // Remove data points outside the time window
          const cutoffTime = Date.now() - TIME_RANGES[selectedRange].ms;
          return newData.filter(d => new Date(d.timestamp).getTime() >= cutoffTime);
        }
      });
    }
  }, [trafficStats, selectedRange]);

  /**
   * Calculate Y-axis domain for auto-scaling
   * Returns [min, max] with some padding
   */
  const yAxisDomain = useMemo(() => {
    if (historicalData.length === 0) return [0, 1000];

    const allValues = historicalData.flatMap(d => [
      d.bytesReceivedPerSec || 0,
      d.bytesSentPerSec || 0
    ]);

    const maxValue = Math.max(...allValues, 1000); // Minimum 1000 for scale
    const minValue = 0;

    // Add 10% padding to the top
    return [minValue, maxValue * 1.1];
  }, [historicalData]);

  /**
   * Format Y-axis tick labels
   */
  const formatYAxis = (value) => {
    if (value === 0) return '0';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(value) / Math.log(k));
    return `${(value / Math.pow(k, i)).toFixed(0)} ${sizes[i]}`;
  };

  /**
   * Render loading state
   */
  if (isLoading && historicalData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Loading traffic data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && historicalData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={loadHistoricalData}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (historicalData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-600">No traffic data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {Object.entries(TIME_RANGES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setSelectedRange(key)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                selectedRange === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Current Stats Display */}
        {trafficStats && (
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Download:</span>
              <span className="ml-1 font-semibold text-green-600">
                {formatBytes(trafficStats.bytesReceivedPerSec)}
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Upload:</span>
              <span className="ml-1 font-semibold text-blue-600">
                {formatBytes(trafficStats.bytesSentPerSec)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={historicalData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              domain={yAxisDomain}
              tickFormatter={formatYAxis}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="bytesReceivedPerSec"
              stroke="#10b981"
              strokeWidth={2}
              name="Download"
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="bytesSentPerSec"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Upload"
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TrafficGraph;
