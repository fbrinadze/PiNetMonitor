# Network Monitor

A comprehensive network monitoring application for Raspberry Pi that provides real-time visibility into connected devices, network health, and traffic patterns through an intuitive web-based dashboard.

## Features

- **Device Discovery**: Automatically discovers all devices on your local network (192.168.1.x subnet)
- **Real-Time Monitoring**: Tracks device connectivity status with automatic updates
- **Traffic Analysis**: Monitors bandwidth usage and traffic patterns with historical data
- **Health Metrics**: Measures latency, packet loss, and jitter for each device
- **Web Dashboard**: Responsive interface accessible from any device with a browser
- **Data Persistence**: Stores device information and historical data (24-hour retention)
- **WebSocket Updates**: Real-time dashboard updates without page refresh

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Usage](#usage)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [License](#license)

## System Requirements

### Hardware
- Raspberry Pi 3 or newer (Raspberry Pi 4 recommended)
- At least 512MB free RAM (1GB+ recommended)
- At least 1GB free disk space
- Ethernet connection (recommended) or WiFi

### Software
- Raspbian OS (Debian-based) or Ubuntu Server
- Node.js 18 or newer
- npm 8 or newer

### Network
- Static IP address recommended (e.g., 192.168.1.167)
- Access to local network (192.168.1.x subnet)

## Quick Start

For Raspberry Pi deployment with automated installation:

```bash
# Clone the repository
git clone <repository-url> ~/network-monitor
cd ~/network-monitor

# Run automated installation
sudo bash deployment/install.sh

# Enable and start the service
sudo systemctl enable network-monitor
sudo systemctl start network-monitor

# Access the dashboard
# Open browser to http://192.168.1.167:3000
```

## Installation

### Prerequisites

1. **Update System**
   ```bash
   sudo apt-get update
   sudo apt-get upgrade -y
   ```

2. **Install Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify installation
   node -v  # Should show v18.x.x or newer
   npm -v   # Should show 8.x.x or newer
   ```

3. **Install Required System Packages**
   ```bash
   sudo apt-get install -y libcap2-bin iputils-ping net-tools git
   ```

### Automated Installation (Recommended)

```bash
# Clone repository
cd ~
git clone <repository-url> network-monitor
cd network-monitor

# Run installation script
sudo bash deployment/install.sh
```

The script will:
- Check system requirements
- Create installation directory (`/opt/network-monitor`)
- Install dependencies
- Build the frontend
- Create configuration files
- Set up Node.js capabilities for raw socket access
- Install systemd service

### Manual Installation

If you prefer manual installation:

```bash
# Create directories
sudo mkdir -p /opt/network-monitor
sudo mkdir -p /var/log/network-monitor
mkdir -p ~/.network-monitor

# Copy application files
sudo cp -r server client package*.json /opt/network-monitor/
cd /opt/network-monitor

# Install backend dependencies
sudo npm ci --production

# Install frontend dependencies and build
cd client
sudo npm ci
sudo npm run build
cd ..

# Set up capabilities for ICMP ping
sudo bash deployment/setup-capabilities.sh

# Install systemd service
sudo cp deployment/network-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
```

## Configuration

### Environment Variables

The application is configured using environment variables in `/opt/network-monitor/.env`.

Copy the example file and edit as needed:

```bash
sudo cp /opt/network-monitor/.env.example /opt/network-monitor/.env
sudo nano /opt/network-monitor/.env
```

Key configuration options:

```bash
# Server Configuration
PORT=3000                    # HTTP server port
HOST=0.0.0.0                # Listen on all interfaces

# Network Configuration
SUBNET=192.168.1            # Subnet to scan (without last octet)
SCAN_INTERVAL=300000        # Network scan interval (5 minutes)
STATUS_CHECK_INTERVAL=30000 # Device status check interval (30 seconds)
HEALTH_CHECK_INTERVAL=60000 # Health metrics interval (60 seconds)

# Data Storage
DATA_DIR=~/.network-monitor # Data storage directory
DATA_RETENTION_HOURS=24     # Historical data retention (24 hours)

# Logging
LOG_LEVEL=info              # Log level: error, warn, info, debug
LOG_DIR=/var/log/network-monitor

# Performance
MAX_CONCURRENT_PINGS=10     # Maximum concurrent ping operations
PING_TIMEOUT=5000           # Ping timeout in milliseconds
```

### Static IP Configuration (Recommended)

Edit `/etc/dhcpcd.conf`:

```bash
sudo nano /etc/dhcpcd.conf
```

Add the following (adjust for your network):

```
interface eth0
static ip_address=192.168.1.167/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

Restart networking:

```bash
sudo systemctl restart dhcpcd
```

## Development

### Backend Development

```bash
# Install dependencies
npm install

# Start backend server
npm run dev:server
```

The backend API will be available at http://localhost:3000/api

### Frontend Development

```bash
# Install frontend dependencies
cd client
npm install

# Start development server with hot reload
npm run dev
```

The frontend will be available at http://localhost:5173 with hot module replacement.
API requests will be proxied to the backend at http://localhost:3000.

### Building for Production

```bash
# Build frontend
npm run build

# This will:
# 1. Install frontend dependencies
# 2. Build the React application with optimizations
# 3. Output static files to client/dist/
```

## Deployment

### Start the Service

```bash
# Enable service to start on boot
sudo systemctl enable network-monitor

# Start the service
sudo systemctl start network-monitor

# Check status
sudo systemctl status network-monitor
```

### Service Management

```bash
# Start service
sudo systemctl start network-monitor

# Stop service
sudo systemctl stop network-monitor

# Restart service
sudo systemctl restart network-monitor

# View logs
sudo journalctl -u network-monitor -f

# View recent logs
sudo journalctl -u network-monitor -n 100
```

### Manual Start (Development)

```bash
cd /opt/network-monitor
sudo node server/index.js
```

## Usage

### Accessing the Dashboard

Open a web browser and navigate to:
```
http://192.168.1.167:3000
```

Replace `192.168.1.167` with your Raspberry Pi's IP address.

### Dashboard Features

- **Device List**: View all discovered devices with IP, MAC, hostname, and status
- **Traffic Graph**: Real-time bandwidth usage with historical data
- **Health Status**: Latency and packet loss metrics for each device
- **Network Overview**: Summary of device counts and traffic statistics

### API Endpoints

The REST API is available at `http://192.168.1.167:3000/api`:

```
GET  /api/devices                    # Get all discovered devices
POST /api/devices/scan               # Trigger network scan
GET  /api/devices/:ip/status         # Get device status
GET  /api/devices/:ip/health         # Get device health metrics
GET  /api/traffic/current            # Get current traffic stats
GET  /api/traffic/history            # Get historical traffic data
GET  /api/health/all                 # Get all health metrics
GET  /api/system/info                # Get system information
```

### WebSocket Events

Real-time updates via WebSocket at `ws://192.168.1.167:3000`:

```javascript
// Subscribe to events
{ type: 'subscribe:devices' }
{ type: 'subscribe:traffic' }
{ type: 'subscribe:health' }

// Receive events
{ type: 'device:discovered', data: {...} }
{ type: 'device:status', data: {...} }
{ type: 'traffic:update', data: {...} }
{ type: 'health:update', data: {...} }
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests only
npm run test:property

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Test Organization

- `tests/unit/` - Unit tests for individual components
- `tests/property/` - Property-based tests using fast-check
- `tests/integration/` - Integration tests for full system
- `tests/frontend/` - Frontend component tests

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u network-monitor -n 50
```

**Common issues:**
- Port 3000 already in use: Change `PORT` in `.env`
- Permission denied: Run `sudo bash deployment/setup-capabilities.sh`
- Node.js not found: Verify Node.js installation with `node -v`

### No Devices Discovered

**Check network connectivity:**
```bash
# Verify network interface
ip addr show

# Test ping
ping -c 3 192.168.1.1

# Check ARP table
arp -a
```

**Verify subnet configuration:**
```bash
sudo cat /opt/network-monitor/.env | grep SUBNET
```

### Dashboard Not Loading

**Check if service is running:**
```bash
sudo systemctl status network-monitor
```

**Check if port is accessible:**
```bash
# From Raspberry Pi
curl http://localhost:3000

# From another device
curl http://192.168.1.167:3000
```

**Check firewall:**
```bash
# If using ufw
sudo ufw allow 3000/tcp
```

### High CPU Usage

**Increase monitoring intervals in `.env`:**
```bash
SCAN_INTERVAL=600000          # 10 minutes
HEALTH_CHECK_INTERVAL=120000  # 2 minutes
```

Then restart:
```bash
sudo systemctl restart network-monitor
```

### View Application Logs

```bash
# Systemd logs
sudo journalctl -u network-monitor -f

# Application logs (production)
sudo tail -f /var/log/network-monitor/app.log
sudo tail -f /var/log/network-monitor/error.log
```

## Monitoring and Maintenance

### Performance Monitoring

```bash
# Check resource usage
top -p $(pgrep -f "node.*network-monitor")

# Expected usage:
# - CPU: < 25% on Raspberry Pi 4
# - Memory: < 200MB
# - Disk: < 100MB for database
```

### Data Management

```bash
# Manual cleanup of old data
cd /opt/network-monitor
npm run cleanup

# Database location
~/.network-monitor/db.json

# Reset database (WARNING: deletes all data)
rm -f ~/.network-monitor/db.json
sudo systemctl restart network-monitor
```

### Updates

```bash
# Stop service
sudo systemctl stop network-monitor

# Update code
cd ~/network-monitor
git pull

# Reinstall
sudo bash deployment/install.sh

# Start service
sudo systemctl start network-monitor
```

### Uninstallation

```bash
cd ~/network-monitor
sudo bash deployment/uninstall.sh

# Optional: Remove user data
rm -rf ~/.network-monitor
```

## Project Structure

```
network-monitor/
├── server/                    # Backend Node.js application
│   ├── components/           # Core monitoring components
│   │   ├── DeviceScanner.js  # Network device discovery
│   │   ├── StatusMonitor.js  # Device connectivity monitoring
│   │   ├── TrafficAnalyzer.js # Network traffic analysis
│   │   ├── HealthMonitor.js  # Network health metrics
│   │   └── DataStore.js      # Data persistence layer
│   ├── api/                  # REST API and WebSocket handlers
│   │   └── server.js         # Express server setup
│   ├── config/               # Configuration files
│   │   └── logger.js         # Winston logger configuration
│   └── index.js              # Main application entry point
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # React UI components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DeviceList.jsx
│   │   │   ├── TrafficGraph.jsx
│   │   │   └── HealthStatusPanel.jsx
│   │   ├── services/         # API and WebSocket services
│   │   │   ├── ApiService.js
│   │   │   └── WebSocketService.js
│   │   └── App.jsx           # Root React component
│   └── dist/                 # Built static files (after build)
├── tests/                     # Test suites
│   ├── unit/                 # Unit tests
│   ├── property/             # Property-based tests
│   ├── integration/          # Integration tests
│   └── frontend/             # Frontend tests
├── deployment/                # Deployment scripts and configs
│   ├── install.sh            # Automated installation script
│   ├── uninstall.sh          # Uninstallation script
│   ├── setup-capabilities.sh # Node.js capability setup
│   ├── network-monitor.service # Systemd service file
│   └── DEPLOYMENT.md         # Detailed deployment guide
├── scripts/                   # Utility scripts
│   └── cleanup.js            # Data cleanup script
├── .env.example              # Environment configuration template
├── package.json              # Backend dependencies
└── README.md                 # This file
```

## Security Considerations

### Network Security
- Application listens on all interfaces (0.0.0.0) by default
- No authentication by default (assumes trusted local network)
- Consider restricting access to specific interfaces in production

### Data Privacy
- Device information stored locally only
- No data transmitted outside local network
- MAC addresses and hostnames may be sensitive

### System Security
- Keep Node.js and dependencies updated: `npm audit`
- Regular security audits: `npm audit fix`
- Monitor logs for suspicious activity

## Documentation

- [Deployment Guide](deployment/DEPLOYMENT.md) - Detailed deployment instructions
- [Requirements Document](.kiro/specs/network-monitor/requirements.md) - Feature requirements
- [Design Document](.kiro/specs/network-monitor/design.md) - Architecture and design
- [Tasks Document](.kiro/specs/network-monitor/tasks.md) - Implementation plan

## Support

For issues and questions:
- Check logs: `sudo journalctl -u network-monitor -f`
- Review troubleshooting section above
- Check GitHub issues: <repository-url>/issues

## License

MIT
