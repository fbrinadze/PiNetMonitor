# Implementation Plan: Network Monitor

## Overview

This implementation plan breaks down the Network Monitor application into discrete, incremental coding tasks. The application will be built as a full-stack Node.js/React system that runs on a Raspberry Pi to monitor local network devices, traffic, and health metrics. Each task builds on previous work, with testing integrated throughout to validate functionality early.

## Tasks

- [x] 1. Initialize project structure and dependencies
  - Create backend directory structure (server/, server/components/, server/api/)
  - Create frontend directory structure (client/src/, client/src/components/)
  - Initialize package.json for backend with Express, ws, node-arp, ping, systeminformation, lowdb, fast-check
  - Initialize package.json for frontend with React, Recharts, Socket.IO Client, Axios, TailwindCSS
  - Set up TypeScript/JSDoc configuration for type checking
  - Configure test framework (Jest) for both backend and frontend
  - _Requirements: 6.1, 7.1_

- [x] 2. Implement Device Scanner component
  - [x] 2.1 Create DeviceScanner class with network scanning logic
    - Implement scanNetwork() method using node-arp and ping sweep for 192.168.1.x subnet
    - Implement scanDevice() method for individual IP scanning
    - Add MAC vendor lookup functionality using OUI database
    - Add reverse DNS lookup for hostname resolution
    - Implement device caching mechanism
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  
  - [ ]* 2.2 Write property test for complete device discovery data
    - **Property 1: Complete Device Discovery Data**
    - **Validates: Requirements 1.2**
  
  - [ ]* 2.3 Write property test for response time recording
    - **Property 2: Response Time Recording**
    - **Validates: Requirements 1.4**
  
  - [ ]* 2.4 Write property test for inactive device marking
    - **Property 3: Inactive Device Marking**
    - **Validates: Requirements 1.5**
  
  - [ ]* 2.5 Write unit tests for DeviceScanner edge cases
    - Test empty network (no devices found)
    - Test DNS lookup failures
    - Test ARP lookup failures
    - Test scan timeout scenarios
    - _Requirements: 1.1, 1.2, 1.5_

- [ ] 3. Implement Status Monitor component
  - [x] 3.1 Create StatusMonitor class with connectivity checking
    - Implement startMonitoring() and stopMonitoring() methods
    - Add ICMP ping functionality for device status checks
    - Implement event emitter pattern for status change notifications
    - Add configurable check interval (default 30 seconds)
    - Implement parallel checking with concurrency limits
    - Add exponential backoff for offline devices
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 3.2 Write property test for status timestamp maintenance
    - **Property 4: Status Timestamp Maintenance**
    - **Validates: Requirements 2.4**
  
  - [x] 3.3 Write unit tests for StatusMonitor
    - Test status change detection (online to offline, offline to online)
    - Test concurrent device monitoring
    - Test exponential backoff behavior
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 4. Checkpoint - Verify device discovery and monitoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Traffic Analyzer component
  - [x] 5.1 Create TrafficAnalyzer class with network interface monitoring
    - Implement startMonitoring() and stopMonitoring() methods
    - Use systeminformation.networkStats() to read interface statistics
    - Calculate bytes per second rates by comparing consecutive readings
    - Implement 1-second sampling for real-time data
    - Add circular buffer for historical data (24 hours with 1-minute granularity)
    - Implement event emitter for traffic updates
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 5.2 Write property test for traffic metrics completeness
    - **Property 5: Traffic Metrics Completeness**
    - **Validates: Requirements 3.2**
  
  - [ ]* 5.3 Write property test for traffic statistics calculation
    - **Property 6: Traffic Statistics Calculation Correctness**
    - **Validates: Requirements 3.5**
  
  - [ ]* 5.4 Write unit tests for TrafficAnalyzer
    - Test rate calculation accuracy
    - Test circular buffer behavior
    - Test historical data retrieval
    - Test interface unavailability handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Implement Health Monitor component
  - [x] 6.1 Create HealthMonitor class with latency and packet loss measurement
    - Implement startMonitoring() and stopMonitoring() methods
    - Send 10 ICMP ping packets per measurement cycle
    - Calculate latency statistics (average, min, max, jitter)
    - Calculate packet loss percentage
    - Implement 60-second update interval per device
    - Add degraded performance detection (latency > 100ms or packet loss > 5%)
    - Implement event emitter for health updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 6.2 Write property test for complete health metrics
    - **Property 7: Complete Health Metrics**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ]* 6.3 Write property test for degraded performance detection
    - **Property 8: Degraded Performance Detection**
    - **Validates: Requirements 4.5**
  
  - [ ]* 6.4 Write unit tests for HealthMonitor
    - Test latency calculation accuracy
    - Test packet loss calculation
    - Test degraded performance threshold detection
    - Test sliding window statistics
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Implement Data Store component
  - [x] 7.1 Create DataStore class with lowdb persistence
    - Initialize lowdb with JSON file storage in ~/.network-monitor/
    - Implement device CRUD operations (save, get, getAll, delete)
    - Implement traffic stats storage and retrieval with time range queries
    - Implement health metrics storage and retrieval with time range queries
    - Add automatic cleanup of data older than 24 hours
    - Implement write-ahead logging pattern for data integrity
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 7.2 Write property test for device persistence round-trip
    - **Property 13: Device Persistence Round-Trip**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ]* 7.3 Write property test for historical data retention
    - **Property 14: Historical Data Retention**
    - **Validates: Requirements 3.4, 9.3, 9.4**
  
  - [ ]* 7.4 Write property test for data cleanup ordering
    - **Property 15: Data Cleanup Ordering**
    - **Validates: Requirements 9.5**
  
  - [ ]* 7.5 Write unit tests for DataStore
    - Test device CRUD operations
    - Test time range queries
    - Test automatic cleanup
    - Test corrupted data handling
    - Test disk full scenarios
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8. Checkpoint - Verify all backend components
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Implement REST API server
  - [x] 9.1 Create Express server with REST endpoints
    - Set up Express app listening on port 3000
    - Implement GET /api/devices endpoint
    - Implement POST /api/devices/scan endpoint
    - Implement GET /api/devices/:ip/status endpoint
    - Implement GET /api/devices/:ip/health endpoint
    - Implement GET /api/traffic/current endpoint
    - Implement GET /api/traffic/history endpoint with query parameters
    - Implement GET /api/health/all endpoint
    - Implement GET /api/system/info endpoint
    - Add error handling middleware
    - Add request logging middleware
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x] 9.2 Write property test for API response JSON format
    - **Property 10: API Response JSON Format**
    - **Validates: Requirements 6.5**
  
  - [x] 9.3 Write property test for API endpoint availability
    - **Property 11: API Endpoint Availability**
    - **Validates: Requirements 6.4**
  
  - [x] 9.4 Write unit tests for REST API endpoints
    - Test each endpoint with valid requests
    - Test invalid request handling (400 errors)
    - Test resource not found handling (404 errors)
    - Test server error handling (500 errors)
    - Test concurrent request handling
    - _Requirements: 6.4, 6.5, 6.6_

- [x] 10. Implement WebSocket server
  - [x] 10.1 Add WebSocket support to Express server
    - Set up ws WebSocket server alongside Express
    - Implement subscription mechanism (subscribe:devices, subscribe:traffic, subscribe:health)
    - Implement unsubscription mechanism
    - Emit device:discovered events when new devices are found
    - Emit device:status events on status changes
    - Emit traffic:update events every second
    - Emit health:update events when metrics update
    - Emit scan:complete events when network scan finishes
    - Add connection/disconnection handling
    - Add error handling for invalid messages
    - _Requirements: 5.5, 5.6_
  
  - [x] 10.2 Write integration tests for WebSocket communication
    - Test subscription/unsubscription flow
    - Test event emission for each event type
    - Test multiple concurrent client connections
    - Test message parsing error handling
    - _Requirements: 5.5, 5.6_

- [x] 11. Wire backend components together
  - [x] 11.1 Create main server initialization module
    - Initialize DataStore and load persisted devices
    - Initialize DeviceScanner and perform initial network scan
    - Initialize StatusMonitor and start monitoring discovered devices
    - Initialize TrafficAnalyzer and start monitoring network interface
    - Initialize HealthMonitor and start monitoring device health
    - Connect component events to WebSocket server for real-time updates
    - Set up periodic network scans (every 5 minutes)
    - Set up automatic data cleanup (every hour)
    - Add graceful shutdown handling
    - _Requirements: 6.3, 8.3, 8.4_
  
  - [x] 11.2 Write property test for error logging
    - **Property 12: Error Logging**
    - **Validates: Requirements 8.5**
  
  - [x] 11.3 Write integration tests for backend system
    - Test full device discovery and monitoring flow
    - Test data persistence across server restarts
    - Test concurrent operations (scanning, monitoring, API requests)
    - _Requirements: 6.3, 8.3, 8.4, 9.2_

- [x] 12. Checkpoint - Verify complete backend functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement frontend WebSocket service
  - [x] 13.1 Create WebSocketService class for frontend
    - Implement connect() and disconnect() methods
    - Implement subscribe() and unsubscribe() methods
    - Implement event emitter pattern for received events
    - Add automatic reconnection with exponential backoff
    - Add connection status tracking
    - Handle message parsing errors gracefully
    - _Requirements: 5.5, 5.6_
  
  - [x] 13.2 Write unit tests for WebSocketService
    - Test connection/disconnection
    - Test subscription management
    - Test reconnection logic
    - Test error handling
    - _Requirements: 5.5, 5.6_

- [x] 14. Implement frontend API service
  - [x] 14.1 Create API service module using Axios
    - Implement fetchDevices() function
    - Implement triggerScan() function
    - Implement fetchDeviceStatus(ip) function
    - Implement fetchDeviceHealth(ip) function
    - Implement fetchCurrentTraffic() function
    - Implement fetchTrafficHistory(start, end) function
    - Implement fetchAllHealth() function
    - Implement fetchSystemInfo() function
    - Add error handling and retry logic
    - _Requirements: 7.4_
  
  - [x] 14.2 Write unit tests for API service
    - Test each API function with mock responses
    - Test error handling
    - Test retry logic
    - _Requirements: 7.4_

- [x] 15. Implement React App component
  - [x] 15.1 Create root App component with state management
    - Set up React state for devices, trafficStats, healthMetrics
    - Initialize WebSocket connection on mount
    - Fetch initial data from API on mount
    - Subscribe to WebSocket events (device, traffic, health updates)
    - Update state when WebSocket events are received
    - Handle WebSocket connection status
    - Implement polling fallback if WebSocket fails
    - Add error boundary for error handling
    - _Requirements: 5.5, 5.6, 7.4, 7.5_
  
  - [ ]* 15.2 Write unit tests for App component
    - Test initial data loading
    - Test WebSocket event handling
    - Test state updates
    - Test error handling
    - _Requirements: 5.5, 5.6, 7.4, 7.5_

- [x] 16. Implement Dashboard component
  - [x] 16.1 Create Dashboard layout component
    - Create responsive grid layout using TailwindCSS
    - Add NetworkOverview section showing device counts and traffic summary
    - Add container for DeviceList component
    - Add container for TrafficGraph component
    - Add container for HealthStatusPanel component
    - Ensure responsive design for desktop, tablet, and mobile
    - _Requirements: 5.1, 7.3_
  
  - [ ]* 16.2 Write unit tests for Dashboard component
    - Test rendering with various data states
    - Test responsive layout
    - _Requirements: 5.1, 7.3_

- [x] 17. Implement DeviceList component
  - [x] 17.1 Create DeviceList table component
    - Display table with columns: IP, MAC, Hostname, Status, Last Seen, Latency, Packet Loss
    - Add sortable column headers
    - Add filter controls for online/offline status
    - Add visual status indicators (green for online, red for offline)
    - Implement click handler to view device details
    - Make table responsive for mobile devices
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 17.2 Write property test for dashboard device rendering completeness
    - **Property 9: Dashboard Device Rendering Completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  
  - [ ]* 17.3 Write unit tests for DeviceList component
    - Test rendering with empty device list
    - Test rendering with multiple devices
    - Test sorting functionality
    - Test filtering functionality
    - Test click interactions
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 18. Implement TrafficGraph component
  - [x] 18.1 Create TrafficGraph visualization component
    - Use Recharts to create line chart
    - Display separate lines for incoming and outgoing traffic
    - Add time range selector (1 hour, 6 hours, 24 hours)
    - Implement Y-axis auto-scaling based on traffic volume
    - Add tooltip showing exact values on hover
    - Update chart in real-time as new data arrives
    - Format bytes as KB/MB/GB for readability
    - _Requirements: 5.4_
  
  - [ ]* 18.2 Write unit tests for TrafficGraph component
    - Test rendering with no data
    - Test rendering with traffic data
    - Test time range selector
    - Test real-time updates
    - _Requirements: 5.4_

- [x] 19. Implement HealthStatusPanel component
  - [x] 19.1 Create HealthStatusPanel component
    - Display list of devices with health metrics
    - Add color-coded status indicators (green/yellow/red)
    - Highlight devices with degraded performance
    - Show latency and packet loss values
    - Add mini sparkline charts for latency trends
    - Sort devices by health status (degraded first)
    - _Requirements: 5.3_
  
  - [ ]* 19.2 Write unit tests for HealthStatusPanel component
    - Test rendering with various health states
    - Test color coding logic
    - Test sorting by health status
    - _Requirements: 5.3_

- [x] 20. Implement frontend error handling
  - [x] 20.1 Add error display components
    - Create ErrorMessage component for displaying API errors
    - Create ConnectionStatus component showing WebSocket status
    - Add error boundary to catch React rendering errors
    - Display user-friendly error messages when backend is unavailable
    - _Requirements: 7.5_
  
  - [x] 20.2 Write unit tests for error handling
    - Test error message display
    - Test connection status indicator
    - Test error boundary behavior
    - _Requirements: 7.5_

- [x] 21. Configure frontend build and serving
  - [x] 21.1 Set up frontend build process
    - Configure Vite or Create React App for production build
    - Set up Express to serve frontend static files
    - Configure API proxy for development
    - Add build scripts to package.json
    - Optimize bundle size and enable code splitting
    - _Requirements: 7.2_
  
  - [x] 21.2 Write integration tests for frontend-backend communication
    - Test API requests from frontend to backend
    - Test WebSocket communication
    - Test static file serving
    - _Requirements: 7.2, 7.4_

- [x] 22. Checkpoint - Verify complete application
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Add deployment configuration
  - [x] 23.1 Create deployment scripts and configuration
    - Create systemd service file for auto-start
    - Create installation script for Raspberry Pi setup
    - Add logging configuration (winston or similar)
    - Create environment configuration file (.env support)
    - Add capability configuration for raw socket access
    - Document required permissions and setup steps
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 23.2 Create README with setup instructions
    - Document system requirements
    - Document installation steps
    - Document configuration options
    - Document running and monitoring the application
    - Document troubleshooting common issues
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 24. Final integration testing
  - [x] 24.1 Write end-to-end integration tests
    - Test complete device discovery flow
    - Test real-time monitoring updates
    - Test data persistence across restarts
    - Test frontend-backend integration
    - Test error recovery scenarios
    - _Requirements: All requirements_

- [ ] 25. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The application requires elevated privileges for ICMP ping and network interface access
- All property tests should run with minimum 100 iterations using fast-check library
- Integration tests should use actual network operations where possible, with mocks for external dependencies
