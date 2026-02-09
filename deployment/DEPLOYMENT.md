# Network Monitor - Deployment Guide

This guide provides detailed instructions for deploying the Network Monitor application on a Raspberry Pi.

## Table of Contents

- [System Requirements](#system-requirements)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Uninstallation](#uninstallation)

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

## Prerequisites

### 1. Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node -v  # Should show v18.x.x or newer
npm -v   # Should show 8.x.x or newer
```

### 3. Install Required System Packages

```bash
sudo apt-get install -y \
  libcap2-bin \
  iputils-ping \
  net-tools \
  git
```

### 4. Configure Static IP (Optional but Recommended)

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

## Installation

### Automated Installation

1. Clone or download the repository:

```bash
cd ~
git clone https://github.com/fbrinadze/PiNetMonitor.git
cd PiNetMonitor
```

2. Run the installation script:

```bash
sudo bash deployment/install.sh
```

The script will:
- Check system requirements
- Create installation directory (`/opt/network-monitor`)
- Install dependencies
- Build the frontend
- Create configuration files
- Set up Node.js capabilities
- Install systemd service

### Manual Installation

If you prefer manual installation:

1. Create directories:

```bash
sudo mkdir -p /opt/network-monitor
sudo mkdir -p /var/log/network-monitor
mkdir -p ~/.network-monitor
```

2. Copy application files:

```bash
sudo cp -r server client package*.json /opt/network-monitor/
cd /opt/network-monitor
```

3. Install dependencies:

```bash
sudo npm ci --production
cd client
sudo npm ci
sudo npm run build
cd ..
```

4. Set up capabilities:

```bash
sudo bash deployment/setup-capabilities.sh
```

5. Install systemd service:

```bash
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
# Server port (default: 3000)
PORT=3000

# Subnet to scan (default: 192.168.1)
SUBNET=192.168.1

# Scan interval in milliseconds (default: 5 minutes)
SCAN_INTERVAL=300000

# Log level: error, warn, info, debug (default: info)
LOG_LEVEL=info

# Data retention in hours (default: 24)
DATA_RETENTION_HOURS=24
```

### Permissions

The application requires elevated privileges for:
- ICMP ping operations (raw sockets)
- Network interface statistics
- ARP table access

Two options:

**Option 1: Use capabilities (recommended)**
```bash
sudo bash deployment/setup-capabilities.sh
```

**Option 2: Run as root**
The systemd service is configured to run as root by default.

## Running the Application

### Enable and Start Service

```bash
# Enable service to start on boot
sudo systemctl enable network-monitor

# Start the service
sudo systemctl start network-monitor

# Check status
sudo systemctl status network-monitor
```

### Manual Start (Development)

```bash
cd /opt/network-monitor
sudo node server/index.js
```

### Access the Dashboard

Open a web browser and navigate to:
```
http://192.168.1.167:3000
```

Replace `192.168.1.167` with your Raspberry Pi's IP address.

## Monitoring and Maintenance

### View Logs

**Using journalctl (systemd logs):**
```bash
# View recent logs
sudo journalctl -u network-monitor -n 100

# Follow logs in real-time
sudo journalctl -u network-monitor -f

# View logs from today
sudo journalctl -u network-monitor --since today

# View error logs only
sudo journalctl -u network-monitor -p err
```

**Using log files (production):**
```bash
# Application logs
sudo tail -f /var/log/network-monitor/app.log

# Error logs
sudo tail -f /var/log/network-monitor/error.log

# Exception logs
sudo tail -f /var/log/network-monitor/exceptions.log
```

### Service Management

```bash
# Start service
sudo systemctl start network-monitor

# Stop service
sudo systemctl stop network-monitor

# Restart service
sudo systemctl restart network-monitor

# Check status
sudo systemctl status network-monitor

# Enable auto-start on boot
sudo systemctl enable network-monitor

# Disable auto-start
sudo systemctl disable network-monitor
```

### Performance Monitoring

**Check resource usage:**
```bash
# CPU and memory usage
top -p $(pgrep -f "node.*network-monitor")

# Detailed process info
ps aux | grep network-monitor
```

**Expected resource usage:**
- CPU: < 25% on Raspberry Pi 4
- Memory: < 200MB
- Disk: < 100MB for database

### Data Management

**Database location:**
```bash
~/.network-monitor/db.json
```

**Manual cleanup:**
```bash
# Remove old data
cd /opt/network-monitor
npm run cleanup

# Reset database (WARNING: deletes all data)
rm -f ~/.network-monitor/db.json
sudo systemctl restart network-monitor
```

### Updates

```bash
# Stop service
sudo systemctl stop network-monitor

# Update code
cd ~/PiNetMonitor
git pull

# Reinstall
sudo bash deployment/install.sh

# Start service
sudo systemctl start network-monitor
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u network-monitor -n 50
```

**Common issues:**
- Port 3000 already in use: Change `PORT` in `.env`
- Permission denied: Run `sudo bash deployment/setup-capabilities.sh`
- Node.js not found: Verify Node.js installation

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
# Check .env file
sudo cat /opt/network-monitor/.env | grep SUBNET
```

### High CPU Usage

**Possible causes:**
- Too many devices on network
- Scan interval too short
- Health check interval too short

**Solutions:**
```bash
# Increase intervals in .env
SCAN_INTERVAL=600000  # 10 minutes
HEALTH_CHECK_INTERVAL=120000  # 2 minutes

# Restart service
sudo systemctl restart network-monitor
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

### Permission Errors

**Reset capabilities:**
```bash
sudo bash deployment/setup-capabilities.sh
```

**Or run as root:**
```bash
# Edit service file
sudo nano /etc/systemd/system/network-monitor.service

# Ensure User=root
# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart network-monitor
```

## Security Considerations

### Network Security

- Application listens on all interfaces (0.0.0.0) by default
- No authentication by default (assumes trusted local network)
- Consider enabling basic auth for production:

```bash
# In .env
ENABLE_AUTH=true
AUTH_USERNAME=admin
AUTH_PASSWORD=your-secure-password
```

### Data Privacy

- Device information stored locally only
- No data transmitted outside local network
- MAC addresses and hostnames may be sensitive
- Consider restricting access to dashboard

### System Security

- Keep Node.js and dependencies updated:
```bash
sudo npm audit
sudo npm update
```

- Regular security audits:
```bash
cd /opt/network-monitor
sudo npm audit fix
```

- Monitor logs for suspicious activity

## Uninstallation

### Automated Uninstallation

```bash
cd ~/network-monitor
sudo bash deployment/uninstall.sh
```

### Manual Uninstallation

```bash
# Stop and disable service
sudo systemctl stop network-monitor
sudo systemctl disable network-monitor

# Remove service file
sudo rm /etc/systemd/system/network-monitor.service
sudo systemctl daemon-reload

# Remove installation
sudo rm -rf /opt/network-monitor
sudo rm -rf /var/log/network-monitor

# Remove user data (optional)
rm -rf ~/.network-monitor
```

## Support

For issues and questions:
- Check logs: `sudo journalctl -u network-monitor -f`
- Review this guide
- Check GitHub issues: https://github.com/yourusername/network-monitor/issues

## License

[Your License Here]
