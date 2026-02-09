import React from 'react';

/**
 * ConnectionStatus component for displaying WebSocket connection status
 * @param {Object} props
 * @param {boolean} props.isConnected - Whether WebSocket is connected
 * @param {boolean} [props.isPolling] - Whether using polling fallback
 * @param {string} [props.error] - Connection error message
 */
function ConnectionStatus({ isConnected, isPolling = false, error = null }) {
  // Determine status and styling
  let status, statusColor, statusText, statusIcon;

  if (isConnected) {
    status = 'connected';
    statusColor = 'bg-green-500';
    statusText = 'Connected';
    statusIcon = (
      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  } else if (isPolling) {
    status = 'polling';
    statusColor = 'bg-yellow-500';
    statusText = 'Polling';
    statusIcon = (
      <svg className="h-4 w-4 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    );
  } else {
    status = 'disconnected';
    statusColor = 'bg-red-500';
    statusText = 'Disconnected';
    statusIcon = (
      <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Status indicator dot */}
      <div className={`h-3 w-3 rounded-full ${statusColor} animate-pulse`}></div>
      
      {/* Status text and icon */}
      <div className="flex items-center space-x-1">
        {statusIcon}
        <span className="text-sm text-gray-600 font-medium">{statusText}</span>
      </div>

      {/* Error tooltip */}
      {error && (
        <div className="relative group">
          <svg className="h-4 w-4 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
