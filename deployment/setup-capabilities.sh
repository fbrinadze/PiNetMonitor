#!/bin/bash

# Setup script for configuring Node.js capabilities
# This allows the application to send ICMP ping packets without running as root

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Network Monitor - Capability Setup${NC}"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Find Node.js binary
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo -e "${RED}Error: Node.js not found in PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}Node.js found at: $NODE_PATH${NC}"

# Check if setcap is available
if ! command -v setcap &> /dev/null; then
    echo -e "${RED}Error: setcap command not found${NC}"
    echo "Please install libcap2-bin package:"
    echo "  sudo apt-get install libcap2-bin"
    exit 1
fi

# Set capabilities
echo -e "${YELLOW}Setting CAP_NET_RAW capability on Node.js binary...${NC}"
setcap cap_net_raw+ep "$NODE_PATH"

# Verify capabilities
echo -e "${YELLOW}Verifying capabilities...${NC}"
CAPS=$(getcap "$NODE_PATH")
if [[ "$CAPS" == *"cap_net_raw+ep"* ]]; then
    echo -e "${GREEN}✓ Capabilities set successfully${NC}"
    echo "  $CAPS"
else
    echo -e "${RED}Error: Failed to set capabilities${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Setup completed successfully!${NC}"
echo ""
echo "The application can now send ICMP ping packets without running as root."
echo ""
echo -e "${YELLOW}Note:${NC} If you update Node.js, you will need to run this script again."
echo ""
