import { useState, useMemo } from 'react';

/**
 * DeviceList component - Displays a table of discovered network devices
 * Features: sortable columns, status filtering, responsive design, click handlers
 * 
 * @param {Object} props
 * @param {Array} props.devices - List of discovered network devices
 * @param {Map<string, Object>} props.healthMetrics - Health metrics for all devices
 * @param {Function} props.onDeviceClick - Callback when device is clicked
 */
function DeviceList({ devices, healthMetrics, onDeviceClick }) {
  const [sortColumn, setSortColumn] = useState('ipAddress');
  const [sortDirection, setSortDirection] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'online', 'offline'

  /**
   * Handle column header click for sorting
   */
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  /**
   * Format timestamp to readable string
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  /**
   * Filter and sort devices
   */
  const filteredAndSortedDevices = useMemo(() => {
    // Filter by status
    let filtered = devices;
    if (statusFilter === 'online') {
      filtered = devices.filter(d => d.isActive);
    } else if (statusFilter === 'offline') {
      filtered = devices.filter(d => !d.isActive);
    }

    // Sort devices
    const sorted = [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'ipAddress':
          // Sort IP addresses numerically
          aValue = a.ipAddress.split('.').map(num => parseInt(num, 10).toString().padStart(3, '0')).join('.');
          bValue = b.ipAddress.split('.').map(num => parseInt(num, 10).toString().padStart(3, '0')).join('.');
          break;
        case 'macAddress':
          aValue = a.macAddress || '';
          bValue = b.macAddress || '';
          break;
        case 'hostname':
          aValue = a.hostname || 'unknown';
          bValue = b.hostname || 'unknown';
          break;
        case 'status':
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        case 'lastSeen':
          aValue = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          bValue = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          break;
        case 'latency':
          const aHealth = healthMetrics?.get(a.ipAddress);
          const bHealth = healthMetrics?.get(b.ipAddress);
          aValue = aHealth?.latency ?? -1;
          bValue = bHealth?.latency ?? -1;
          break;
        case 'packetLoss':
          const aHealthPL = healthMetrics?.get(a.ipAddress);
          const bHealthPL = healthMetrics?.get(b.ipAddress);
          aValue = aHealthPL?.packetLoss ?? -1;
          bValue = bHealthPL?.packetLoss ?? -1;
          break;
        default:
          aValue = a.ipAddress;
          bValue = b.ipAddress;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [devices, healthMetrics, sortColumn, sortDirection, statusFilter]);

  /**
   * Render sort indicator icon
   */
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  /**
   * Render status indicator
   */
  const StatusIndicator = ({ isActive }) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-2 h-2 mr-1.5 rounded-full bg-green-400"></span>
          Online
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <span className="w-2 h-2 mr-1.5 rounded-full bg-red-400"></span>
        Offline
      </span>
    );
  };

  // Empty state
  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
        <p className="mt-1 text-sm text-gray-500">Start a network scan to discover devices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All ({devices.length})
        </button>
        <button
          onClick={() => setStatusFilter('online')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            statusFilter === 'online'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Online ({devices.filter(d => d.isActive).length})
        </button>
        <button
          onClick={() => setStatusFilter('offline')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            statusFilter === 'offline'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Offline ({devices.filter(d => !d.isActive).length})
        </button>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* IP Address Column */}
              <th
                onClick={() => handleSort('ipAddress')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>IP Address</span>
                  <SortIcon column="ipAddress" />
                </div>
              </th>

              {/* MAC Address Column - Hidden on mobile */}
              <th
                onClick={() => handleSort('macAddress')}
                className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>MAC Address</span>
                  <SortIcon column="macAddress" />
                </div>
              </th>

              {/* Hostname Column */}
              <th
                onClick={() => handleSort('hostname')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>Hostname</span>
                  <SortIcon column="hostname" />
                </div>
              </th>

              {/* Status Column */}
              <th
                onClick={() => handleSort('status')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <SortIcon column="status" />
                </div>
              </th>

              {/* Last Seen Column - Hidden on mobile */}
              <th
                onClick={() => handleSort('lastSeen')}
                className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>Last Seen</span>
                  <SortIcon column="lastSeen" />
                </div>
              </th>

              {/* Latency Column - Hidden on mobile */}
              <th
                onClick={() => handleSort('latency')}
                className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>Latency</span>
                  <SortIcon column="latency" />
                </div>
              </th>

              {/* Packet Loss Column - Hidden on mobile */}
              <th
                onClick={() => handleSort('packetLoss')}
                className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center space-x-1">
                  <span>Packet Loss</span>
                  <SortIcon column="packetLoss" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedDevices.map((device) => {
              const health = healthMetrics?.get(device.ipAddress);
              
              return (
                <tr
                  key={device.ipAddress}
                  onClick={() => onDeviceClick && onDeviceClick(device)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* IP Address */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {device.ipAddress}
                  </td>

                  {/* MAC Address - Hidden on mobile */}
                  <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {device.macAddress || 'N/A'}
                  </td>

                  {/* Hostname */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {device.hostname || 'unknown'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusIndicator isActive={device.isActive} />
                  </td>

                  {/* Last Seen - Hidden on mobile */}
                  <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(device.lastSeen)}
                  </td>

                  {/* Latency - Hidden on mobile */}
                  <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {health?.latency !== undefined && health.latency >= 0
                      ? `${health.latency.toFixed(1)} ms`
                      : 'N/A'}
                  </td>

                  {/* Packet Loss - Hidden on mobile */}
                  <td className="hidden xl:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {health?.packetLoss !== undefined && health.packetLoss >= 0
                      ? `${health.packetLoss.toFixed(1)}%`
                      : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No results message */}
      {filteredAndSortedDevices.length === 0 && devices.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">No devices match the selected filter.</p>
        </div>
      )}
    </div>
  );
}

export default DeviceList;
