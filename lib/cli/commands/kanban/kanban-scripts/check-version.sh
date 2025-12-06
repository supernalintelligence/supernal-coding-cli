#!/bin/bash

# Kanban Version Checker
# Compares local kanban version with latest available version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
UPSTREAM_REPO="https://raw.githubusercontent.com/your-org/supernal-nova/main"
VERSION_FILE="scripts/project-management/kanban/kanban-unified.sh"
LOCAL_KANBAN="./kanban"
FALLBACK_KANBAN="./scripts/project-management/kanban/kanban-unified.sh"

# Function to extract version from file
get_version() {
    local file="$1"
    if [[ -f "$file" ]]; then
        grep "KANBAN_VERSION=" "$file" | head -1 | cut -d'"' -f2
    else
        echo "unknown"
    fi
}

# Function to compare versions (basic semantic versioning)
version_compare() {
    local version1="$1"
    local version2="$2"
    
    # Convert versions to comparable numbers
    v1_major=$(echo "$version1" | cut -d. -f1)
    v1_minor=$(echo "$version1" | cut -d. -f2 || echo "0")
    v1_patch=$(echo "$version1" | cut -d. -f3 || echo "0")
    
    v2_major=$(echo "$version2" | cut -d. -f1)
    v2_minor=$(echo "$version2" | cut -d. -f2 || echo "0")
    v2_patch=$(echo "$version2" | cut -d. -f3 || echo "0")
    
    # Compare major.minor.patch
    if [[ $v1_major -lt $v2_major ]]; then
        echo "older"
    elif [[ $v1_major -gt $v2_major ]]; then
        echo "newer"
    elif [[ $v1_minor -lt $v2_minor ]]; then
        echo "older"
    elif [[ $v1_minor -gt $v2_minor ]]; then
        echo "newer"
    elif [[ $v1_patch -lt $v2_patch ]]; then
        echo "older"
    elif [[ $v1_patch -gt $v2_patch ]]; then
        echo "newer"
    else
        echo "same"
    fi
}

# Function to get latest version from upstream
get_latest_version() {
    echo -e "${BLUE}Checking latest version...${NC}"
    
    # Try to fetch latest version from upstream
    if command -v curl >/dev/null 2>&1; then
        LATEST_CONTENT=$(curl -s "$UPSTREAM_REPO/$VERSION_FILE" 2>/dev/null || true)
    elif command -v wget >/dev/null 2>&1; then
        LATEST_CONTENT=$(wget -qO- "$UPSTREAM_REPO/$VERSION_FILE" 2>/dev/null || true)
    else
        echo -e "${RED}Error: Neither curl nor wget available for version checking${NC}"
        return 1
    fi
    
    if [[ -z "$LATEST_CONTENT" ]]; then
        echo -e "${YELLOW}Warning: Could not fetch latest version from upstream${NC}"
        return 1
    fi
    
    echo "$LATEST_CONTENT" | grep "KANBAN_VERSION=" | head -1 | cut -d'"' -f2
}

# Function to show detailed version information
show_version_info() {
    local local_version="$1"
    local latest_version="$2"
    local comparison="$3"
    
    echo -e "\n${BOLD}Kanban Version Status${NC}"
    echo -e "===================="
    echo -e "Local version:  ${YELLOW}$local_version${NC}"
    echo -e "Latest version: ${YELLOW}$latest_version${NC}"
    echo -e ""
    
    case "$comparison" in
        "same")
            echo -e "Status: ${GREEN}✅ Up to date${NC}"
            ;;
        "newer")
            echo -e "Status: ${BLUE}🚀 Ahead of upstream${NC}"
            echo -e "You're running a newer version than what's available upstream."
            ;;
        "older")
            echo -e "Status: ${RED}⚠️  Update available${NC}"
            echo -e ""
            echo -e "To update:"
            echo -e "  ${YELLOW}./kanban update${NC}"
            echo -e "  ${YELLOW}# or${NC}"
            echo -e "  ${YELLOW}./scripts/project-management/install-kanban.sh --update${NC}"
            ;;
        *)
            echo -e "Status: ${YELLOW}❓ Unknown${NC}"
            ;;
    esac
}

# Main execution
main() {
    echo -e "${BOLD}Kanban Version Checker${NC}"
    echo -e "====================="
    
    # Find local kanban installation
    LOCAL_VERSION="unknown"
    if [[ -x "$LOCAL_KANBAN" ]]; then
        LOCAL_VERSION=$(get_version "$LOCAL_KANBAN")
        echo -e "Found kanban at: ${GREEN}$LOCAL_KANBAN${NC}"
    elif [[ -f "$FALLBACK_KANBAN" ]]; then
        LOCAL_VERSION=$(get_version "$FALLBACK_KANBAN")
        echo -e "Found kanban at: ${GREEN}$FALLBACK_KANBAN${NC}"
        echo -e "${YELLOW}Note: Consider symlinking to ./kanban for easier access${NC}"
    else
        echo -e "${RED}Error: Kanban system not found${NC}"
        echo -e "Run the installer to set up kanban in this repository."
        exit 1
    fi
    
    if [[ "$LOCAL_VERSION" == "unknown" ]]; then
        echo -e "${RED}Error: Could not determine local version${NC}"
        exit 1
    fi
    
    # Get latest version
    LATEST_VERSION=$(get_latest_version)
    if [[ -z "$LATEST_VERSION" ]]; then
        echo -e "\n${BOLD}Local Version Only${NC}"
        echo -e "=================="
        echo -e "Local version: ${YELLOW}$LOCAL_VERSION${NC}"
        echo -e "Latest version: ${RED}Unknown (offline)${NC}"
        exit 0
    fi
    
    # Compare versions
    COMPARISON=$(version_compare "$LOCAL_VERSION" "$LATEST_VERSION")
    
    # Show results
    show_version_info "$LOCAL_VERSION" "$LATEST_VERSION" "$COMPARISON"
    
    # Return appropriate exit code
    case "$COMPARISON" in
        "older")
            exit 2  # Update available
            ;;
        "same")
            exit 0  # Up to date
            ;;
        "newer")
            exit 0  # Ahead of upstream
            ;;
        *)
            exit 1  # Error
            ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quiet, -q    Only show version numbers"
        echo "  --latest       Only show latest available version"
        echo "  --local        Only show local version"
        echo ""
        echo "Exit codes:"
        echo "  0 - Up to date or ahead"
        echo "  1 - Error"
        echo "  2 - Update available"
        exit 0
        ;;
    "--quiet"|"-q")
        # Quiet mode - just show versions
        LOCAL_VERSION="unknown"
        if [[ -x "$LOCAL_KANBAN" ]]; then
            LOCAL_VERSION=$(get_version "$LOCAL_KANBAN")
        elif [[ -f "$FALLBACK_KANBAN" ]]; then
            LOCAL_VERSION=$(get_version "$FALLBACK_KANBAN")
        fi
        
        LATEST_VERSION=$(get_latest_version 2>/dev/null || echo "unknown")
        echo "local:$LOCAL_VERSION latest:$LATEST_VERSION"
        exit 0
        ;;
    "--latest")
        get_latest_version
        exit 0
        ;;
    "--local")
        if [[ -x "$LOCAL_KANBAN" ]]; then
            get_version "$LOCAL_KANBAN"
        elif [[ -f "$FALLBACK_KANBAN" ]]; then
            get_version "$FALLBACK_KANBAN"
        else
            echo "unknown"
        fi
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac 