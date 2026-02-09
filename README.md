# Network Monitor

A network monitoring application for Raspberry Pi that provides real-time visibility into connected devices, network health, and traffic patterns.

## Project Structure

```
network-monitor/
├── server/                 # Backend Node.js application
│   ├── components/        # Core monitoring components
│   └── api/              # REST API and WebSocket handlers
├── client/                # Frontend React application
│   └── src/
│       └── components/   # React UI components
└── tests/                # Test suites
    ├── unit/            # Unit tests
    ├── property/        # Property-based tests
    └── integration/     # Integration tests
```

## Installation

### Backend
```bash
npm install
```

### Frontend
```bash
cd client
npm install
```

## Development

### Start Backend
```bash
npm run dev:server
```

### Start Frontend (Development Mode)
```bash
npm run dev:client
```

The frontend will be available at http://localhost:5173 with hot module replacement.
API requests will be proxied to the backend at http://localhost:3000.

## Production Build

### Build Frontend
```bash
npm run build
```

This will:
1. Install frontend dependencies
2. Build the React application with optimizations
3. Output static files to `client/dist/`

### Start Production Server
```bash
npm start
```

The server will:
- Serve the API at http://localhost:3000/api
- Serve the frontend static files at http://localhost:3000
- Handle WebSocket connections for real-time updates

## Deployment

### Raspberry Pi Setup

1. **Install Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and Build**
   ```bash
   git clone <repository-url> /opt/network-monitor
   cd /opt/network-monitor
   npm install
   npm run build
   ```

3. **Configure Permissions**
   ```bash
   # Grant raw socket access for ICMP ping
   sudo setcap cap_net_raw+ep $(which node)
   ```

4. **Set Static IP** (recommended)
   Edit `/etc/dhcpcd.conf`:
   ```
   interface eth0
   static ip_address=192.168.1.167/24
   static routers=192.168.1.1
   static domain_name_servers=192.168.1.1
   ```

5. **Create Systemd Service**
   Create `/etc/systemd/system/network-monitor.service`:
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

6. **Enable and Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable network-monitor
   sudo systemctl start network-monitor
   ```

7. **Check Status**
   ```bash
   sudo systemctl status network-monitor
   journalctl -u network-monitor -f
   ```

### Access the Application

Once deployed, access the web interface at:
- http://192.168.1.167:3000 (or your configured IP)

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property tests only
npm run test:property

# Run with coverage
npm run test:coverage
```

## Requirements

- Node.js 18 or newer
- Raspberry Pi 3 or newer (for deployment)
- Elevated privileges for network operations

## License

MIT
