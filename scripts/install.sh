#!/bin/bash
# Hyperion Installer
# One-line: curl -fsSL https://raw.githubusercontent.com/yogeshsinghkatoch9/hyperion/main/scripts/install.sh | bash

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╦ ╦╦ ╦╔═╗╔═╗╦═╗╦╔═╗╔╗╔${NC}"
echo -e "${BOLD}╠═╣╚╦╝╠═╝║╣ ╠╦╝║║ ║║║║${NC}"
echo -e "${BOLD}╩ ╩ ╩ ╩  ╚═╝╩╚═╩╚═╝╝╚╝${NC}"
echo ""

# Check prerequisites
if ! command -v docker &>/dev/null; then
    echo -e "${RED}Error: Docker is required but not installed.${NC}"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
    echo -e "${RED}Error: Docker Compose is required but not installed.${NC}"
    echo "Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Determine install directory
INSTALL_DIR="${HYPERION_DIR:-$HOME/hyperion}"

if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    echo -e "${YELLOW}Existing installation found at $INSTALL_DIR${NC}"
    echo "Updating..."
else
    echo -e "Installing to ${BOLD}$INSTALL_DIR${NC}"
    mkdir -p "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Download docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/yogeshsinghkatoch9/hyperion/main/docker-compose.yml -o docker-compose.yml

# Start Hyperion
echo ""
echo "Starting Hyperion..."
if docker compose version &>/dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

echo ""
echo -e "${GREEN}${BOLD}Hyperion is running!${NC}"
echo ""
echo -e "  Open ${BOLD}http://localhost:3333${NC} in your browser"
echo -e "  Create your admin account at first login"
echo ""
echo -e "  ${YELLOW}Manage:${NC}"
echo -e "    Stop:    cd $INSTALL_DIR && docker compose down"
echo -e "    Logs:    cd $INSTALL_DIR && docker compose logs -f"
echo -e "    Update:  curl -fsSL https://raw.githubusercontent.com/yogeshsinghkatoch9/hyperion/main/scripts/install.sh | bash"
echo ""
