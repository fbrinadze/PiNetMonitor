# Deployment Files

This directory contains all the necessary files for deploying the Network Monitor application on a Raspberry Pi.

## Files Overview

### Installation Scripts

- **install.sh** - Automated installation script
  - Checks system requirements
  - Creates installation directories
  - Installs dependencies
  - Builds frontend
  - Configures environment
  - Sets up Node.js capabilities
  - Installs systemd service

- **uninstall.sh** - Automated uninstallation script
  - Stops and disables service
  - Removes installation files
  - Removes logs
  - Preserves user data (optional removal)

- **setup-capabilities.sh** - Node.js capability configuration
  - Sets CAP_NET_RAW capability for ICMP ping
  - Allows non-root network operations
  - Must be run after Node.js updates

### Configuration Files

- **network-monitor.service** - Systemd service file
  - Auto-start on boot
  - Automatic restart on failure
  - Resource limits
  - Security hardening

- **.env.example** (in project root) - Environment configuration template
  - Server settings
  - Network configuration
  - Logging options
  - Performance tuning

### Documentation

- **DEPLOYMENT.md** - Comprehensive deployment guide
  - System requirements
  - Installation instructions
  - Configuration options
  - Troubleshooting
  - Maintenance procedures

- **README.md** (in project root) - Main project documentation
  - Quick start guide
  - Development setup
  - Usage instructions
  - API documentation

## Quick Start

### Automated Installation

```bash
# Clone repository
git clone <repository-url> ~/network-monitor
cd ~/network-monitor

# Run installation
sudo bash deployment/install.sh

# Enable and start service
sudo systemctl enable network-monitor
sudo systemctl start network-monitor
```

### Manual Installation

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed manual installation steps.

## Post-Installation

### Configure Environment

```bash
sudo nano /opt/network-monitor/.env
```

### Start Service

```bash
sudo systemctl start network-monitor
```

### Check Status

```bash
sudo systemctl status network-monitor
sudo journalctl -u network-monitor -f
```

### Access Dashboard

Open browser to: http://192.168.1.167:3000

## Maintenance

### View Logs

```bash
# Systemd logs
sudo journalctl -u network-monitor -f

# Application logs
sudo tail -f /var/log/network-monitor/app.log
```

### Update Application

```bash
cd ~/network-monitor
git pull
sudo bash deployment/install.sh
sudo systemctl restart network-monitor
```

### Cleanup Old Data

```bash
cd /opt/network-monitor
npm run cleanup
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
sudo journalctl -u network-monitor -n 50

# Verify Node.js
node -v

# Check permissions
sudo bash deployment/setup-capabilities.sh
```

### No Devices Found

```bash
# Check network
ip addr show
ping -c 3 192.168.1.1

# Verify configuration
sudo cat /opt/network-monitor/.env | grep SUBNET
```

## Security Notes

- Application requires elevated privileges for network operations
- Runs as root by default (systemd service)
- Alternative: Use capabilities (setup-capabilities.sh)
- No authentication by default (trusted local network assumed)
- Consider firewall rules for production use

## Support

For detailed information, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [Main README](../README.md) - Project documentation
- [Requirements](.kiro/specs/network-monitor/requirements.md) - Feature requirements
- [Design](.kiro/specs/network-monitor/design.md) - Architecture details
