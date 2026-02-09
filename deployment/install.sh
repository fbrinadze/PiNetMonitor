#!/bin/bash

# Network Monitor Installation Script for Raspberry Pi
# This script installs and configures the Network Monitor application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/network-monitor"
SERVICE_NAME="network-monitor"
LOG_DIR="/var/log/network-monitor"
DATA_DIR="$HOME/.network-monitor"

echo -e "${GREEN}Network Monitor Installation Script${NC}"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check system requirements
echo -e "${YELLOW}Checking system requirements...${NC}"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 18 or newer:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js version 18 or newer is required (found: $(node -v))${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v) found${NC}"

# Check available memory
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 512 ]; then
    echo -e "${YELLOW}Warning: Less than 512MB RAM available. Application may run slowly.${NC}"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -m / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 1024 ]; then
    echo -e "${YELLOW}Warning: Less than 1GB disk space available.${NC}"
fi

echo ""

# Create installation directory
echo -e "${YELLOW}Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"

# Copy application files
echo -e "${YELLOW}Copying application files...${NC}"
if [ -d "server" ] && [ -d "client" ]; then
    cp -r server "$INSTALL_DIR/"
    cp -r client "$INSTALL_DIR/"
    cp package*.json "$INSTALL_DIR/"
    [ -f ".env.example" ] && cp .env.example "$INSTALL_DIR/"
    echo -e "${GREEN}✓ Application files copied${NC}"
else
    echo -e "${RED}Error: Cannot find server/ and client/ directories${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$INSTALL_DIR"
npm ci --production --no-audit
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd "$INSTALL_DIR/client"
npm ci --no-audit
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# Create .env file if it doesn't exist
cd "$INSTALL_DIR"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env configuration file...${NC}"
    cat > .env << EOF
# Network Monitor Configuration

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Network Configuration
SUBNET=192.168.1
SCAN_INTERVAL=300000
STATUS_CHECK_INTERVAL=30000
TRAFFIC_UPDATE_INTERVAL=1000
HEALTH_CHECK_INTERVAL=60000

# Data Storage
DATA_DIR=$DATA_DIR
DATA_RETENTION_HOURS=24

# Logging
LOG_LEVEL=info
LOG_DIR=$LOG_DIR

# Performance
MAX_CONCURRENT_PINGS=10
PING_TIMEOUT=5000
EOF
    echo -e "${GREEN}✓ Configuration file created${NC}"
else
    echo -e "${GREEN}✓ Configuration file already exists${NC}"
fi

# Set up Node.js capabilities for raw socket access
echo -e "${YELLOW}Configuring Node.js capabilities for ICMP ping...${NC}"
NODE_PATH=$(which node)
setcap cap_net_raw+ep "$NODE_PATH" || {
    echo -e "${YELLOW}Warning: Failed to set capabilities. Application will need to run as root.${NC}"
}
echo -e "${GREEN}✓ Capabilities configured${NC}"

# Install systemd service
echo -e "${YELLOW}Installing systemd service...${NC}"
if [ -f "deployment/network-monitor.service" ]; then
    cp deployment/network-monitor.service /etc/systemd/system/
    systemctl daemon-reload
    echo -e "${GREEN}✓ Systemd service installed${NC}"
else
    echo -e "${YELLOW}Warning: systemd service file not found${NC}"
fi

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chown -R root:root "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"
chown -R root:root "$LOG_DIR"
chmod -R 755 "$LOG_DIR"
echo -e "${GREEN}✓ Permissions set${NC}"

echo ""
echo -e "${GREEN}Installation completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review and edit configuration: $INSTALL_DIR/.env"
echo "2. Enable service to start on boot: sudo systemctl enable $SERVICE_NAME"
echo "3. Start the service: sudo systemctl start $SERVICE_NAME"
echo "4. Check service status: sudo systemctl status $SERVICE_NAME"
echo "5. View logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "Access the dashboard at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
