#!/bin/bash

# Kanban System Installer
# Installs the kanban management system in a new repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
KANBAN_VERSION="2.0.0"
UPSTREAM_REPO="https://raw.githubusercontent.com/your-org/supernal-nova/main/scripts/project-management/kanban"
INSTALL_DIR="scripts/project-management/kanban"
DOCS_DIR="docs/planning/kanban"

echo -e "${BOLD}🗂️  Kanban System Installer v${KANBAN_VERSION}${NC}"
echo -e "============================================"
echo ""

# Function to detect current directory type
detect_repository() {
    if [[ -f "package.json" ]]; then
        echo -e "📦 ${GREEN}Node.js project detected${NC}"
        PROJECT_TYPE="nodejs"
    elif [[ -f "requirements.txt" ]] || [[ -f "pyproject.toml" ]]; then
        echo -e "🐍 ${GREEN}Python project detected${NC}"
        PROJECT_TYPE="python"
    elif [[ -f "go.mod" ]]; then
        echo -e "🔷 ${GREEN}Go project detected${NC}"
        PROJECT_TYPE="go"
    elif [[ -f ".git/config" ]]; then
        echo -e "📂 ${GREEN}Git repository detected${NC}"
        PROJECT_TYPE="git"
    else
        echo -e "❓ ${YELLOW}Unknown project type${NC}"
        PROJECT_TYPE="unknown"
    fi
    
    if [[ -d ".git" ]]; then
        echo -e "✅ Git repository: ${GREEN}Yes${NC}"
    else
        echo -e "⚠️  Git repository: ${YELLOW}No (recommended to initialize)${NC}"
    fi
    echo ""
}

# Function to check if kanban is already installed
check_existing_installation() {
    if [[ -f "$INSTALL_DIR/kanban-unified.sh" ]]; then
        echo -e "📋 ${YELLOW}Kanban system already exists${NC}"
        
        # Get current version
        if command -v ./kanban >/dev/null 2>&1; then
            CURRENT_VERSION=$(./kanban --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
            echo -e "Current version: ${BLUE}$CURRENT_VERSION${NC}"
        else
            echo -e "Current version: ${YELLOW}Unknown${NC}"
        fi
        
        echo -e ""
        read -p "Do you want to update/reinstall? (y/N): " -n 1 -r
        echo ""
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}Installation cancelled${NC}"
            exit 0
        fi
        
        UPDATING=true
    else
        echo -e "📋 ${GREEN}New kanban installation${NC}"
        UPDATING=false
    fi
    echo ""
}

# Function to download kanban files
download_kanban_files() {
    echo -e "${BOLD}Downloading Kanban Files${NC}"
    echo -e "-------------------------"
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DOCS_DIR"/{TODO,DOING,DONE,BACKLOG,HANDOFFS}
    
    # List of files to download
    FILES=(
        "kanban-unified.sh"
        "check-version.sh"
        "README.md"
    )
    
    for file in "${FILES[@]}"; do
        echo -e "Downloading ${BLUE}$file${NC}..."
        
        if command -v curl >/dev/null 2>&1; then
            curl -sL "$UPSTREAM_REPO/$file" -o "$INSTALL_DIR/$file"
        elif command -v wget >/dev/null 2>&1; then
            wget -q "$UPSTREAM_REPO/$file" -O "$INSTALL_DIR/$file"
        else
            echo -e "${RED}Error: Neither curl nor wget found${NC}"
            echo -e "Please install curl or wget to download files"
            exit 1
        fi
        
        if [[ $? -eq 0 ]]; then
            echo -e "✅ ${GREEN}$file downloaded${NC}"
        else
            echo -e "❌ ${RED}Failed to download $file${NC}"
        fi
    done
    echo ""
}

# Function to set up kanban symlink/command
setup_kanban_command() {
    echo -e "${BOLD}Setting Up Kanban Command${NC}"
    echo -e "-------------------------"
    
    # Make kanban script executable
    chmod +x "$INSTALL_DIR/kanban-unified.sh"
    chmod +x "$INSTALL_DIR/check-version.sh"
    
    # Create symlink for easy access
    if [[ -L "./kanban" ]] || [[ -f "./kanban" ]]; then
        rm -f "./kanban"
    fi
    
    ln -sf "$INSTALL_DIR/kanban-unified.sh" "./kanban"
    
    if [[ -x "./kanban" ]]; then
        echo -e "✅ ${GREEN}Kanban command ready: ./kanban${NC}"
    else
        echo -e "❌ ${RED}Failed to create kanban command${NC}"
        exit 1
    fi
    echo ""
}

# Function to initialize kanban structure
initialize_kanban() {
    echo -e "${BOLD}Initializing Kanban Structure${NC}"
    echo -e "-----------------------------"
    
    # Create sample tasks if this is a new installation
    if [[ "$UPDATING" == "false" ]] && [[ ! -f "$DOCS_DIR/TODO"/*.md ]]; then
        echo -e "Creating sample tasks..."
        
        ./kanban new todo "Setup project documentation"
        ./kanban new todo "Configure development environment" 
        ./kanban new backlog "Add comprehensive test suite"
        
        echo -e "✅ ${GREEN}Sample tasks created${NC}"
    fi
    
    # Verify installation
    echo -e "Testing kanban commands..."
    if ./kanban list >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}Kanban system working${NC}"
    else
        echo -e "❌ ${RED}Kanban system test failed${NC}"
        exit 1
    fi
    echo ""
}

# Function to add to .gitignore if needed
setup_gitignore() {
    echo -e "${BOLD}Git Configuration${NC}"
    echo -e "-----------------"
    
    if [[ -f ".gitignore" ]]; then
        # Check if kanban files are already in .gitignore
        if ! grep -q "docs/planning/kanban" .gitignore; then
            echo -e "Adding kanban docs to .gitignore..."
            echo "" >> .gitignore
            echo "# Kanban system (optional - remove if you want to track tasks)" >> .gitignore
            echo "# docs/planning/kanban/" >> .gitignore
            echo -e "✅ ${GREEN}.gitignore updated${NC}"
        else
            echo -e "✅ ${GREEN}Kanban already in .gitignore${NC}"
        fi
    else
        echo -e "ℹ️  ${BLUE}No .gitignore found (optional)${NC}"
    fi
    echo ""
}

# Function to show next steps
show_next_steps() {
    echo -e "${BOLD}🎉 Installation Complete!${NC}"
    echo -e "=========================="
    echo -e ""
    echo -e "🚀 ${BOLD}Quick Start:${NC}"
    echo -e "  ${YELLOW}./kanban list${NC}              # Show current tasks"
    echo -e "  ${YELLOW}./kanban new todo \"task\"${NC}   # Create new task"
    echo -e "  ${YELLOW}./kanban move \"task\" doing${NC} # Move task to doing"
    echo -e "  ${YELLOW}./kanban done \"task\"${NC}       # Mark task complete"
    echo -e ""
    echo -e "📚 ${BOLD}Learn More:${NC}"
    echo -e "  ${YELLOW}./kanban help${NC}              # Show all commands"
    echo -e "  ${YELLOW}cat $INSTALL_DIR/README.md${NC} # Read documentation"
    echo -e ""
    echo -e "🔧 ${BOLD}Administration:${NC}"
    echo -e "  ${YELLOW}./kanban --version${NC}         # Check version"
    echo -e "  ${YELLOW}./$INSTALL_DIR/check-version.sh${NC} # Check for updates"
    echo -e ""
    echo -e "📂 ${BOLD}Files Created:${NC}"
    echo -e "  • ${BLUE}$INSTALL_DIR/${NC}    # Kanban system files"
    echo -e "  • ${BLUE}$DOCS_DIR/${NC}        # Task directories"
    echo -e "  • ${BLUE}./kanban${NC}                 # Command symlink"
    echo -e ""
}

# Main installation process
main() {
    echo -e "Starting kanban system installation...\n"
    
    detect_repository
    check_existing_installation
    download_kanban_files
    setup_kanban_command
    initialize_kanban
    setup_gitignore
    show_next_steps
    
    echo -e "${GREEN}✅ Kanban system successfully installed!${NC}"
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Kanban System Installer"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "This script installs the kanban management system in the current repository."
        echo ""
        echo "Options:"
        echo "  --help, -h       Show this help"
        echo "  --version, -v    Show installer version"
        echo ""
        echo "What gets installed:"
        echo "  • scripts/project-management/kanban/    # System files"
        echo "  • docs/planning/kanban/                 # Task directories"
        echo "  • ./kanban                              # Command symlink"
        echo ""
        exit 0
        ;;
    "--version"|"-v")
        echo "Kanban System Installer v$KANBAN_VERSION"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 