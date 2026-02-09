import { useMemo } from 'react';

/**
 * Get health status color based on metrics
 * @param {Object} health - Health metrics object
 * @returns {string} - Color class name ('green', 'yellow', or 'red')
 */
const getHealthStatusColor = (health) => {
  if (!health || health.latency < 0) return 'gray';
  
  // Red: latency > 100ms or packet loss > 5%
  if (health.latency > 100 || health.packetLoss > 5) {
    return 'red';
  }
  
  // Yellow: latency > 50ms or packet loss > 2%
  if (health.latency > 50 || health.packetLoss > 2) {
    return 'yellow';
  }
  
  // Green: good health
  return 'green';
};

/**
 * Mini sparkline chart component for latency trends
 * @param {Object} props
 * @param {number} props.latency - Current latency value
 * @param {number} props.minLatency - Minimum latency
 * @param {number} props.maxLatency - Maximum latency
 */
const LatencySparkline = ({ latency, minLatency, maxLatency }) => {
  // Generate simple trend visualization based on current vs min/max
  const range = maxLatency - minLatency;
  const position = range > 0 ? ((latency - minLatency) / range) * 100 : 50;
  
  return (
    <div className="flex items-center space-x-1">
      <div className="w-16 h-6 bg-gray-100 rounded relative overflow-hidden">
        {/* Min marker */}
        <div 
          className="absolute bottom-0 left-0 w-0.5 h-2 bg-green-400"
          title={`Min: ${minLatency.toFixed(1)}ms`}
        />
        
        {/* Max marker */}
        <div 
          className="absolute bottom-0 right-0 w-0.5 h-2 bg-red-400"
          title={`Max: ${maxLatency.toFixed(1)}ms`}
        />
        
        {/* Current position indicator */}
        <div 
          className="absolute bottom-0 w-1 h-4 bg-blue-500 rounded-t transition-all"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          title={`Current: ${latency.toFixed(1)}ms`}
        />
        
        {/* Gradient background showing range */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 opacity-30" />
      </div>
    </div>
  );
};

/**
 * Status indicator component with color coding
 * @param {Object} props
 * @param {string} props.color - Color name ('green', 'yellow', 'red', 'gray')
 * @param {boolean} props.isDegraded - Whether device has degraded performance
 */
const StatusIndicator = ({ color, isDegraded }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const dotClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400',
  };

  const labels = {
    green: 'Healthy',
    yellow: 'Warning',
    red: 'Degraded',
    gray: 'Unknown',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[color]}`}>
      <span className={`w-2 h-2 mr-1.5 rounded-full ${dotClasses[color]} ${isDegraded ? 'animate-pulse' : ''}`}></span>
      {labels[color]}
    </span>
  );
};

/**
 * HealthStatusPanel Component
 * Displays network health metrics for all devices with color-coded status indicators
 * 
 * @param {Object} props
 * @param {Map<string, Object>} props.healthMetrics - Health metrics for all devices
 * @param {Array} props.devices - List of discovered network devices
 */
function HealthStatusPanel({ healthMetrics, devices }) {
  /**
   * Sort devices by health status (degraded first) and then by latency
   */
  const sortedDevices = useMemo(() => {
    if (!devices || devices.length === 0) return [];
    
    return [...devices]
      .map(device => {
        const health = healthMetrics?.get(device.ipAddress);
        return {
          ...device,
          health,
          statusColor: getHealthStatusColor(health),
        };
      })
      .sort((a, b) => {
        // Sort by degraded status first (degraded devices first)
        const aDegraded = a.health?.isDegraded ? 1 : 0;
        const bDegraded = b.health?.isDegraded ? 1 : 0;
        
        if (bDegraded !== aDegraded) {
          return bDegraded - aDegraded;
        }
        
        // Then sort by status color priority (red > yellow > green > gray)
        const colorPriority = { red: 3, yellow: 2, green: 1, gray: 0 };
        const aPriority = colorPriority[a.statusColor] || 0;
        const bPriority = colorPriority[b.statusColor] || 0;
        
        if (bPriority !== aPriority) {
          return bPriority - aPriority;
        }
        
        // Finally sort by latency (higher latency first)
        const aLatency = a.health?.latency ?? -1;
        const bLatency = b.health?.latency ?? -1;
        
        return bLatency - aLatency;
      });
  }, [devices, healthMetrics]);

  /**
   * Calculate summary statistics
   */
  const summary = useMemo(() => {
    const devicesWithHealth = sortedDevices.filter(d => d.health && d.health.latency >= 0);
    
    return {
      total: devices.length,
      healthy: sortedDevices.filter(d => d.statusColor === 'green').length,
      warning: sortedDevices.filter(d => d.statusColor === 'yellow').length,
      degraded: sortedDevices.filter(d => d.statusColor === 'red').length,
      unknown: sortedDevices.filter(d => d.statusColor === 'gray').length,
      avgLatency: devicesWithHealth.length > 0
        ? devicesWithHealth.reduce((sum, d) => sum + d.health.latency, 0) / devicesWithHealth.length
        : 0,
    };
  }, [sortedDevices, devices]);

  // Empty state
  if (!devices || devices.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No devices to monitor</h3>
        <p className="mt-1 text-sm text-gray-500">Start a network scan to discover devices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <p className="text-xs text-gray-600 mb-1">Healthy</p>
          <p className="text-2xl font-bold text-green-600">{summary.healthy}</p>
        </div>
        
        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p className="text-xs text-gray-600 mb-1">Warning</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.warning}</p>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <p className="text-xs text-gray-600 mb-1">Degraded</p>
          <p className="text-2xl font-bold text-red-600">{summary.degraded}</p>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-xs text-gray-600 mb-1">Avg Latency</p>
          <p className="text-2xl font-bold text-blue-600">
            {summary.avgLatency > 0 ? `${summary.avgLatency.toFixed(0)}ms` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Device Health List */}
      <div className="space-y-2">
        {sortedDevices.map((device) => {
          const { health, statusColor } = device;
          const hasHealth = health && health.latency >= 0;

          return (
            <div
              key={device.ipAddress}
              className={`p-4 rounded-lg border transition-all ${
                device.health?.isDegraded
                  ? 'bg-red-50 border-red-200 shadow-sm'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Device Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {device.hostname || 'unknown'}
                    </h3>
                    <StatusIndicator 
                      color={statusColor} 
                      isDegraded={device.health?.isDegraded || false}
                    />
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-3">
                    {device.ipAddress} • {device.macAddress || 'N/A'}
                  </p>

                  {/* Health Metrics */}
                  {hasHealth ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Latency */}
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Latency</p>
                        <div className="flex items-center space-x-2">
                          <p className={`text-lg font-semibold ${
                            health.latency > 100 ? 'text-red-600' :
                            health.latency > 50 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {health.latency.toFixed(1)} ms
                          </p>
                          <LatencySparkline 
                            latency={health.latency}
                            minLatency={health.minLatency}
                            maxLatency={health.maxLatency}
                          />
                        </div>
                      </div>

                      {/* Packet Loss */}
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Packet Loss</p>
                        <p className={`text-lg font-semibold ${
                          health.packetLoss > 5 ? 'text-red-600' :
                          health.packetLoss > 2 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {health.packetLoss.toFixed(1)}%
                        </p>
                      </div>

                      {/* Jitter */}
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Jitter</p>
                        <p className="text-lg font-semibold text-gray-700">
                          {health.jitter !== undefined ? `${health.jitter.toFixed(1)} ms` : 'N/A'}
                        </p>
                      </div>

                      {/* Latency Range */}
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Latency Range</p>
                        <p className="text-sm text-gray-700">
                          {health.minLatency.toFixed(1)} - {health.maxLatency.toFixed(1)} ms
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No health data available
                    </div>
                  )}

                  {/* Last Updated */}
                  {hasHealth && health.lastUpdated && (
                    <p className="text-xs text-gray-400 mt-2">
                      Last updated: {new Date(health.lastUpdated).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="ml-4">
                  {statusColor === 'green' && (
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {statusColor === 'yellow' && (
                    <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {statusColor === 'red' && (
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {statusColor === 'gray' && (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HealthStatusPanel;
