# Design Document: Network Monitor

## Overview

The Network Monitor is a full-stack web application designed to run on a Raspberry Pi, providing comprehensive monitoring of a local network (192.168.1.x subnet). The system consists of a Node.js backend that performs network scanning, status monitoring, traffic analysis, and health checks, paired with a React frontend that visualizes this data in real-time through a responsive web dashboard.

The architecture follows a client-server model where the backend continuously monitors the network and exposes data through REST APIs and WebSocket connections, while the frontend provides an interactive dashboard accessible from any device on the network.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Raspberry Pi (192.168.1.167)            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Node.js Backend Server                     │ │
│  │                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   Device     │  │   Status     │  │   Traffic    │ │ │
│  │  │   Scanner    │  │   Monitor    │  │   Analyzer   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  │                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   Health     │  │   Data       │  │   REST API   │ │ │
│  │  │   Monitor    │  │   Store      │  │   + WebSocket│ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Frontend (Static Files)              │ │
│  │                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │   Device     │  │   Traffic    │  │   Health     │ │ │
│  │  │   List View  │  │   Graph View │  │   Status View│ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            ▼
                  ┌──────────────────┐
                  │  Client Browser  │
                  │  (Any Device)    │
                  └──────────────────┘
```

### Technology Stack

**Backend:**
- Node.js (runtime environment)
- Express.js (web framework)
- ws (WebSocket library for real-time updates)
- node-arp (ARP table scanning for device discovery)
- ping (ICMP ping for latency measurement)
- systeminformation (system and network interface statistics)
- lowdb (lightweight JSON database for persistence)

**Frontend:**
- React 18 (UI framework)
- Recharts (data visualization library)
- Socket.IO Client (WebSocket communication)
- Axios (HTTP client)
- TailwindCSS (styling framework)

### Communication Patterns

1. **REST API**: Used for initial data loading and on-demand operations (device scans, historical data queries)
2. **WebSocket**: Used for real-time updates (device status changes, live traffic data, health metrics)
3. **Polling Fallback**: Frontend implements polling as fallback if WebSocket connection fails

## Components and Interfaces

### Backend Components

#### 1. Device Scanner

**Purpose**: Discovers devices on the local network using ARP scanning and ping sweeps.

**Interface**:
```javascript
class DeviceScanner {
  // Scan the network for active devices
  async scanNetwork(subnet: string): Promise<Device[]>
  
  // Scan a specific IP address
  async scanDevice(ipAddress: string): Promise<Device | null>
  
  // Get cached scan results
  getCachedDevices(): Device[]
}

interface Device {
  ipAddress: string      // e.g., "192.168.1.100"
  macAddress: string     // e.g., "AA:BB:CC:DD:EE:FF"
  hostname: string       // e.g., "johns-laptop" or "unknown"
  vendor: string         // e.g., "Apple Inc." (from MAC lookup)
  firstSeen: Date        // When device was first discovered
  lastSeen: Date         // Last successful connectivity check
  isActive: boolean      // Current online/offline status
}
```

**Implementation Approach**:
- Use `node-arp` to read the system ARP table for quick device discovery
- Perform ping sweep of 192.168.1.1-254 to discover devices not in ARP table
- Use reverse DNS lookup to resolve hostnames
- Perform MAC vendor lookup using OUI database
- Cache results to avoid redundant scans

#### 2. Status Monitor

**Purpose**: Continuously monitors the connectivity status of discovered devices.

**Interface**:
```javascript
class StatusMonitor {
  // Start monitoring a device
  startMonitoring(device: Device): void
  
  // Stop monitoring a device
  stopMonitoring(ipAddress: string): void
  
  // Get current status of all monitored devices
  getDeviceStatuses(): Map<string, DeviceStatus>
  
  // Register callback for status changes
  onStatusChange(callback: (ipAddress: string, status: DeviceStatus) => void): void
}

interface DeviceStatus {
  ipAddress: string
  isOnline: boolean
  lastChecked: Date
  responseTime: number   // milliseconds, -1 if offline
}
```

**Implementation Approach**:
- Use ICMP ping to check device connectivity
- Implement configurable check interval (default: 30 seconds)
- Use event emitter pattern to notify subscribers of status changes
- Implement exponential backoff for offline devices to reduce network load
- Run checks in parallel using Promise.all with concurrency limit

#### 3. Traffic Analyzer

**Purpose**: Monitors network traffic on the Raspberry Pi's network interface.

**Interface**:
```javascript
class TrafficAnalyzer {
  // Start traffic monitoring
  startMonitoring(interfaceName: string): void
  
  // Stop traffic monitoring
  stopMonitoring(): void
  
  // Get current traffic statistics
  getCurrentStats(): TrafficStats
  
  // Get historical traffic data
  getHistoricalStats(startTime: Date, endTime: Date): TrafficStats[]
  
  // Register callback for traffic updates
  onTrafficUpdate(callback: (stats: TrafficStats) => void): void
}

interface TrafficStats {
  timestamp: Date
  bytesReceived: number      // Total bytes received
  bytesSent: number          // Total bytes sent
  bytesReceivedPerSec: number // Current receive rate
  bytesSentPerSec: number    // Current send rate
  packetsReceived: number
  packetsSent: number
}
```

**Implementation Approach**:
- Use `systeminformation.networkStats()` to read interface statistics
- Calculate rates by comparing consecutive readings
- Sample every 1 second for real-time data
- Store historical data with 1-minute granularity for 24 hours
- Implement circular buffer to limit memory usage

#### 4. Health Monitor

**Purpose**: Measures network health metrics (latency, packet loss) for each device.

**Interface**:
```javascript
class HealthMonitor {
  // Start health monitoring for a device
  startMonitoring(ipAddress: string): void
  
  // Stop health monitoring for a device
  stopMonitoring(ipAddress: string): void
  
  // Get current health metrics
  getHealthMetrics(ipAddress: string): HealthMetrics
  
  // Get all health metrics
  getAllHealthMetrics(): Map<string, HealthMetrics>
  
  // Register callback for health updates
  onHealthUpdate(callback: (ipAddress: string, metrics: HealthMetrics) => void): void
}

interface HealthMetrics {
  ipAddress: string
  latency: number           // Average latency in ms, -1 if unreachable
  minLatency: number        // Minimum latency in measurement window
  maxLatency: number        // Maximum latency in measurement window
  packetLoss: number        // Packet loss percentage (0-100)
  jitter: number            // Latency variation in ms
  lastUpdated: Date
  isDegraded: boolean       // True if latency > 100ms or packet loss > 5%
}
```

**Implementation Approach**:
- Send 10 ICMP ping packets per measurement cycle
- Calculate statistics from ping results
- Update metrics every 60 seconds per device
- Use sliding window for calculating averages
- Flag degraded performance based on thresholds

#### 5. Data Store

**Purpose**: Persists device information and historical data to disk.

**Interface**:
```javascript
class DataStore {
  // Device operations
  async saveDevice(device: Device): Promise<void>
  async getDevice(ipAddress: string): Promise<Device | null>
  async getAllDevices(): Promise<Device[]>
  async deleteDevice(ipAddress: string): Promise<void>
  
  // Historical data operations
  async saveTrafficStats(stats: TrafficStats): Promise<void>
  async getTrafficStats(startTime: Date, endTime: Date): Promise<TrafficStats[]>
  
  async saveHealthMetrics(metrics: HealthMetrics): Promise<void>
  async getHealthMetrics(ipAddress: string, startTime: Date, endTime: Date): Promise<HealthMetrics[]>
  
  // Cleanup operations
  async cleanupOldData(olderThan: Date): Promise<void>
}
```

**Implementation Approach**:
- Use `lowdb` with JSON file storage
- Store data in `~/.network-monitor/` directory
- Separate collections for devices, traffic stats, and health metrics
- Implement automatic cleanup of data older than 24 hours
- Use write-ahead logging pattern to prevent data corruption

#### 6. REST API Server

**Purpose**: Exposes HTTP endpoints for frontend communication.

**API Endpoints**:

```
GET  /api/devices
     Returns: Device[]
     Description: Get all discovered devices

POST /api/devices/scan
     Returns: { status: "started", estimatedTime: number }
     Description: Trigger a new network scan

GET  /api/devices/:ip/status
     Returns: DeviceStatus
     Description: Get current status of a specific device

GET  /api/devices/:ip/health
     Returns: HealthMetrics
     Description: Get health metrics for a specific device

GET  /api/traffic/current
     Returns: TrafficStats
     Description: Get current traffic statistics

GET  /api/traffic/history?start=<timestamp>&end=<timestamp>
     Returns: TrafficStats[]
     Description: Get historical traffic data

GET  /api/health/all
     Returns: Map<string, HealthMetrics>
     Description: Get health metrics for all devices

GET  /api/system/info
     Returns: { version: string, uptime: number, hostname: string }
     Description: Get system information
```

**WebSocket Events**:

```
Server -> Client:
  - device:discovered { device: Device }
  - device:status { ipAddress: string, status: DeviceStatus }
  - traffic:update { stats: TrafficStats }
  - health:update { ipAddress: string, metrics: HealthMetrics }
  - scan:complete { deviceCount: number }

Client -> Server:
  - subscribe:devices
  - subscribe:traffic
  - subscribe:health
  - unsubscribe:devices
  - unsubscribe:traffic
  - unsubscribe:health
```

### Frontend Components

#### 1. App Component

**Purpose**: Root component that manages application state and routing.

**Structure**:
```javascript
function App() {
  const [devices, setDevices] = useState<Device[]>([])
  const [trafficStats, setTrafficStats] = useState<TrafficStats | null>(null)
  const [healthMetrics, setHealthMetrics] = useState<Map<string, HealthMetrics>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  
  // Initialize WebSocket connection
  // Fetch initial data
  // Handle real-time updates
  
  return (
    <div className="app">
      <Header />
      <Dashboard 
        devices={devices}
        trafficStats={trafficStats}
        healthMetrics={healthMetrics}
      />
    </div>
  )
}
```

#### 2. Dashboard Component

**Purpose**: Main dashboard layout that organizes monitoring views.

**Structure**:
```javascript
function Dashboard({ devices, trafficStats, healthMetrics }) {
  return (
    <div className="dashboard">
      <NetworkOverview 
        deviceCount={devices.length}
        onlineCount={devices.filter(d => d.isActive).length}
        trafficStats={trafficStats}
      />
      <DeviceList devices={devices} healthMetrics={healthMetrics} />
      <TrafficGraph trafficStats={trafficStats} />
      <HealthStatusPanel healthMetrics={healthMetrics} />
    </div>
  )
}
```

#### 3. DeviceList Component

**Purpose**: Displays a table of all discovered devices with their status.

**Features**:
- Sortable columns (IP, hostname, status, last seen)
- Filterable by status (online/offline)
- Click device to view detailed metrics
- Visual indicators for online/offline status
- Responsive table layout

#### 4. TrafficGraph Component

**Purpose**: Visualizes network traffic over time using line charts.

**Features**:
- Real-time updating line chart
- Separate lines for incoming/outgoing traffic
- Time range selector (1 hour, 6 hours, 24 hours)
- Y-axis auto-scaling based on traffic volume
- Tooltip showing exact values on hover

#### 5. HealthStatusPanel Component

**Purpose**: Displays network health metrics and alerts.

**Features**:
- List of devices with degraded performance
- Latency and packet loss indicators
- Color-coded status (green/yellow/red)
- Historical health trends

#### 6. WebSocket Service

**Purpose**: Manages WebSocket connection and event handling.

**Interface**:
```javascript
class WebSocketService {
  connect(url: string): void
  disconnect(): void
  subscribe(event: string, callback: Function): void
  unsubscribe(event: string): void
  emit(event: string, data: any): void
  isConnected(): boolean
}
```

## Data Models

### Device Model
```javascript
{
  ipAddress: "192.168.1.100",
  macAddress: "AA:BB:CC:DD:EE:FF",
  hostname: "johns-laptop",
  vendor: "Apple Inc.",
  firstSeen: "2024-01-15T10:30:00Z",
  lastSeen: "2024-01-15T14:25:30Z",
  isActive: true
}
```

### DeviceStatus Model
```javascript
{
  ipAddress: "192.168.1.100",
  isOnline: true,
  lastChecked: "2024-01-15T14:25:30Z",
  responseTime: 12.5
}
```

### TrafficStats Model
```javascript
{
  timestamp: "2024-01-15T14:25:00Z",
  bytesReceived: 1048576000,
  bytesSent: 524288000,
  bytesReceivedPerSec: 125000,
  bytesSentPerSec: 62500,
  packetsReceived: 1000000,
  packetsSent: 500000
}
```

### HealthMetrics Model
```javascript
{
  ipAddress: "192.168.1.100",
  latency: 15.5,
  minLatency: 10.2,
  maxLatency: 25.8,
  packetLoss: 0.5,
  jitter: 3.2,
  lastUpdated: "2024-01-15T14:25:00Z",
  isDegraded: false
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Complete Device Discovery Data

*For any* device discovered during a network scan, the device object must contain valid IP address, MAC address, hostname (or "unknown"), and vendor information.

**Validates: Requirements 1.2**

### Property 2: Response Time Recording

*For any* device that responds to discovery probes, the scanner must record a non-negative response time value.

**Validates: Requirements 1.4**

### Property 3: Inactive Device Marking

*For any* device that does not respond to discovery probes, the scanner must mark it with isActive set to false.

**Validates: Requirements 1.5**

### Property 4: Status Timestamp Maintenance

*For any* device being monitored, the status object must contain a valid lastChecked timestamp that is not in the future.

**Validates: Requirements 2.4**

### Property 5: Traffic Metrics Completeness

*For any* traffic statistics report, it must contain both bytesReceivedPerSec and bytesSentPerSec with non-negative values.

**Validates: Requirements 3.2**

### Property 6: Traffic Statistics Calculation Correctness

*For any* set of traffic data points, the calculated average, minimum, and maximum values must be mathematically correct (min ≤ average ≤ max, and min/max must exist in the dataset).

**Validates: Requirements 3.5**

### Property 7: Complete Health Metrics

*For any* device being health-monitored, the health metrics must contain latency (in milliseconds), packet loss percentage (0-100), and jitter values.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 8: Degraded Performance Detection

*For any* health metrics where latency exceeds 100ms or packet loss exceeds 5%, the isDegraded flag must be set to true.

**Validates: Requirements 4.5**

### Property 9: Dashboard Device Rendering Completeness

*For any* list of devices passed to the dashboard, the rendered output must include all devices with their IP address, MAC address, hostname, status, last seen timestamp, and health metrics (latency and packet loss).

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: API Response JSON Format

*For any* REST API endpoint response, the response must be valid JSON that can be parsed without errors.

**Validates: Requirements 6.5**

### Property 11: API Endpoint Availability

*For any* required API endpoint (devices, status, health, traffic), a GET request must return a successful response (status 200) with the expected data structure.

**Validates: Requirements 6.4**

### Property 12: Error Logging

*For any* error condition that occurs during monitoring operations, an error log entry must be created with timestamp, error message, and context information.

**Validates: Requirements 8.5**

### Property 13: Device Persistence Round-Trip

*For any* device that is saved to storage, retrieving it from storage (including after a server restart) must return an equivalent device object with the same IP address, MAC address, and hostname.

**Validates: Requirements 9.1, 9.2**

### Property 14: Historical Data Retention

*For any* traffic statistics or health metrics saved to storage, querying for data within the past 24 hours must return the saved data, while data older than 24 hours may be absent.

**Validates: Requirements 3.4, 9.3, 9.4**

### Property 15: Data Cleanup Ordering

*For any* cleanup operation that removes historical data, the data with the oldest timestamps must be removed before data with newer timestamps.

**Validates: Requirements 9.5**

## Error Handling

### Network Errors

**Device Unreachable**:
- When a device doesn't respond to ping: Mark as offline, set responseTime to -1
- When DNS lookup fails: Use "unknown" as hostname
- When ARP lookup fails: Continue with IP-only information

**Network Interface Errors**:
- When traffic monitoring fails: Log error, return last known good stats
- When interface is unavailable: Retry with exponential backoff (1s, 2s, 4s, max 30s)
- When permission denied: Log clear error message about requiring elevated privileges

### Storage Errors

**Disk Full**:
- Trigger emergency cleanup of oldest data
- Log warning message
- Continue operation with in-memory data only if cleanup fails

**Corrupted Data**:
- Skip corrupted records during load
- Log error with details
- Initialize with empty dataset if all data is corrupted

**Write Failures**:
- Retry write operation up to 3 times
- Log error if all retries fail
- Continue operation (data will be lost but system remains functional)

### API Errors

**Invalid Requests**:
- Return 400 Bad Request with descriptive error message
- Log the invalid request for debugging

**Resource Not Found**:
- Return 404 Not Found with helpful message
- Suggest valid alternatives (e.g., list of valid IP addresses)

**Server Errors**:
- Return 500 Internal Server Error
- Log full error stack trace
- Ensure error doesn't crash the server

### WebSocket Errors

**Connection Failures**:
- Frontend automatically attempts reconnection with exponential backoff
- Display connection status indicator to user
- Fall back to polling if WebSocket unavailable

**Message Parsing Errors**:
- Log error with message content
- Skip invalid message
- Continue processing other messages

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both **unit tests** and **property-based tests** to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property tests**: Verify universal properties across all inputs using randomized testing

Together, these approaches provide complementary coverage where unit tests catch concrete bugs and property tests verify general correctness across a wide input space.

### Property-Based Testing Configuration

**Library Selection**:
- Backend (Node.js): Use `fast-check` library for property-based testing
- Frontend (React): Use `fast-check` with React Testing Library

**Test Configuration**:
- Each property test must run a minimum of 100 iterations
- Each test must include a comment tag referencing the design property
- Tag format: `// Feature: network-monitor, Property N: [property description]`
- Each correctness property from the design must be implemented by exactly one property-based test

**Example Property Test Structure**:
```javascript
// Feature: network-monitor, Property 1: Complete Device Discovery Data
test('discovered devices contain all required fields', () => {
  fc.assert(
    fc.property(
      fc.ipV4(),
      fc.macAddress(),
      fc.string(),
      (ip, mac, hostname) => {
        const device = discoverDevice(ip, mac, hostname);
        expect(device).toHaveProperty('ipAddress');
        expect(device).toHaveProperty('macAddress');
        expect(device).toHaveProperty('hostname');
        expect(device).toHaveProperty('vendor');
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Focus Areas

**Specific Examples**:
- Test device discovery with known IP/MAC combinations
- Test traffic calculation with specific byte values
- Test health metrics with known latency values

**Edge Cases**:
- Empty device list
- Zero traffic
- Maximum values (254 devices, very high latency)
- Boundary conditions (exactly 100ms latency, exactly 5% packet loss)

**Error Conditions**:
- Network timeouts
- Invalid IP addresses
- Corrupted storage data
- WebSocket disconnections

**Integration Points**:
- API endpoint responses
- WebSocket message handling
- Database read/write operations
- Frontend-backend communication

### Test Organization

```
tests/
├── unit/
│   ├── device-scanner.test.js
│   ├── status-monitor.test.js
│   ├── traffic-analyzer.test.js
│   ├── health-monitor.test.js
│   ├── data-store.test.js
│   └── api-server.test.js
├── property/
│   ├── device-discovery.property.test.js
│   ├── monitoring.property.test.js
│   ├── traffic.property.test.js
│   ├── health.property.test.js
│   ├── persistence.property.test.js
│   └── api.property.test.js
├── integration/
│   ├── end-to-end.test.js
│   └── websocket.test.js
└── frontend/
    ├── components/
    │   ├── DeviceList.test.jsx
    │   ├── TrafficGraph.test.jsx
    │   └── HealthStatusPanel.test.jsx
    └── property/
        └── rendering.property.test.jsx
```

### Testing Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property tests only
npm run test:property

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Deployment Considerations

### Raspberry Pi Setup

**System Requirements**:
- Raspberry Pi 3 or newer
- Raspbian OS (Debian-based)
- Node.js 18 or newer
- At least 512MB free RAM
- At least 1GB free disk space

**Network Configuration**:
- Static IP address: 192.168.1.167
- Connected to local network via Ethernet (recommended) or WiFi

**Permissions**:
- Application requires elevated privileges for:
  - ICMP ping operations (raw sockets)
  - Network interface statistics
  - ARP table access
- Run with `sudo` or configure capabilities: `sudo setcap cap_net_raw+ep $(which node)`

### Installation Steps

1. Install Node.js and npm
2. Clone repository to `/opt/network-monitor`
3. Install dependencies: `npm install`
4. Build frontend: `npm run build`
5. Configure systemd service for auto-start
6. Start service: `sudo systemctl start network-monitor`

### Systemd Service Configuration

```ini
[Unit]
Description=Network Monitor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/network-monitor
ExecStart=/usr/bin/node /opt/network-monitor/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Monitoring and Maintenance

**Log Files**:
- Application logs: `/var/log/network-monitor/app.log`
- Error logs: `/var/log/network-monitor/error.log`
- Systemd logs: `journalctl -u network-monitor`

**Data Storage**:
- Database location: `~/.network-monitor/db.json`
- Automatic cleanup of data older than 24 hours
- Manual cleanup: `npm run cleanup`

**Performance Monitoring**:
- Monitor CPU usage: Should stay below 25% on Raspberry Pi 4
- Monitor memory usage: Should stay below 200MB
- Monitor disk usage: Database should not exceed 100MB

### Security Considerations

**Network Security**:
- Application only listens on local network interface
- No authentication required (assumes trusted local network)
- Consider adding basic auth for production use

**Data Privacy**:
- Device information stored locally only
- No data transmitted outside local network
- MAC addresses and hostnames may be sensitive

**System Security**:
- Run with minimum required privileges
- Keep Node.js and dependencies updated
- Regular security audits of dependencies: `npm audit`
