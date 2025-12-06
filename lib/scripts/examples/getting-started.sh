#!/bin/bash

# Supernal Coding - Getting Started Script
# Copy-paste this script to quickly set up Supernal Coding in any repository

set -e  # Exit on any error

echo "🚀 Supernal Coding - Getting Started"
echo "====================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from within a git repository"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Get the repository root
REPO_ROOT=$(git rev-parse --show-toplevel)
echo "📁 Repository root: $REPO_ROOT"

# Check if Supernal Coding is already initialized
if [ -f "$REPO_ROOT/supernal.yaml" ]; then
    echo "⚠️  Supernal Coding appears to be already initialized"
    echo "Configuration file found: $REPO_ROOT/supernal.yaml"
    read -p "Do you want to reinitialize? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
fi

# Navigate to repository root
cd "$REPO_ROOT"

echo "🔧 Initializing Supernal Coding..."

# Run the init command
if sc init --yes; then
    echo "✅ Supernal Coding initialized successfully!"
else
    echo "❌ Failed to initialize Supernal Coding"
    echo "Please check the error messages above"
    exit 1
fi

echo "🔍 Validating installation..."

# Run validation
if sc validate-installation --all; then
    echo "✅ Installation validated successfully!"
else
    echo "⚠️  Validation completed with warnings"
    echo "Please review the validation output above"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Review the generated configuration: cat supernal.yaml"
echo "2. Explore available commands: sc --help"
echo "3. Check your project structure: ls -la supernal-coding/"
echo ""
echo "Common commands:"
echo "  sc priority show          # Show requirement priorities"
echo "  sc validate-installation  # Validate your setup"
echo "  sc agent onboard          # Start agent workflow"
echo "  sc kanban list            # List kanban tasks"
echo ""
echo "📚 Documentation:"
echo "  - README.md                              # Quick start guide"
echo "  - docs/CLI_USAGE_GUIDE.md               # Complete command reference"
echo "  - docs/CONFIGURATION_SYSTEM_GUIDE.md    # Configuration guide"
echo ""
echo "🧪 Run tests to see examples:"
echo "  npm test -- tests/requirements/req-003/multi-repo-init.test.js"
echo ""
echo "Happy coding! 🚀" 