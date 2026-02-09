import { useState } from 'react';
import DeviceList from './DeviceList';
import TrafficGraph from './TrafficGraph';
import HealthStatusPanel from './HealthStatusPanel';

/**
 * Dashboard component - Main layout for network monitoring interface
 * Provides responsive grid layout with network overview and monitoring sections
 * 
 * @param {Object} props
 * @param {Array} props.devices - List of discovered network devices
 * @param {Object} props.trafficStats - Current traffic statistics
 * @param {Map<string, Object>} props.healthMetrics - Health metrics for all devices
 */
function Dashboard({ devices, trafficStats, healthMetrics }) {
  const [selectedDevice, setSelectedDevice] = useState(null);

  /**
   * Handle device click to view details
   */
  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    // TODO: Show device details modal or panel
    console.log('Device clicked:', device);
  };
  return (
    <div className="space-y-6">
      {/* Network Overview Section */}
      <NetworkOverview 
        devices={devices}
        trafficStats={trafficStats}
      />

      {/* Main Grid Layout - Responsive for desktop, tablet, and mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device List Container */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Devices</h2>
            <DeviceList 
              devices={devices}
              healthMetrics={healthMetrics}
              onDeviceClick={handleDeviceClick}
            />
          </div>
        </div>

        {/* Traffic Graph Container */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Network Traffic</h2>
            <TrafficGraph trafficStats={trafficStats} />
          </div>
        </div>

        {/* Health Status Panel Container */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Health Status</h2>
            <HealthStatusPanel 
              healthMetrics={healthMetrics}
              devices={devices}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * NetworkOverview component - Displays summary statistics
 * Shows device counts and traffic summary in a responsive grid
 * 
 * @param {Object} props
 * @param {Array} props.devices - List of discovered network devices
 * @param {Object} props.trafficStats - Current traffic statistics
 */
function NetworkOverview({ devices, trafficStats }) {
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.isActive).length;
  const offlineDevices = totalDevices - onlineDevices;
  
  // Format traffic data
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const downloadSpeed = trafficStats ? formatBytes(trafficStats.bytesReceivedPerSec) : 'N/A';
  const uploadSpeed = trafficStats ? formatBytes(trafficStats.bytesSentPerSec) : 'N/A';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Network Overview</h2>
      
      {/* Responsive grid: 1 column on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Devices</p>
              <p className="text-3xl font-bold text-blue-600">{totalDevices}</p>
            </div>
            <div className="text-blue-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Online Devices */}
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Online</p>
              <p className="text-3xl font-bold text-green-600">{onlineDevices}</p>
            </div>
            <div className="text-green-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Offline Devices */}
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Offline</p>
              <p className="text-3xl font-bold text-red-600">{offlineDevices}</p>
            </div>
            <div className="text-red-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Traffic Summary */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">Traffic</p>
              <div className="space-y-1">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-purple-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-sm font-semibold text-purple-600">{downloadSpeed}</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-purple-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-sm font-semibold text-purple-600">{uploadSpeed}</span>
                </div>
              </div>
            </div>
            <div className="text-purple-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
