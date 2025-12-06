#!/bin/bash

echo "🔧 Setting up pre-commit hooks for type duplication checking..."

# Check if husky is installed
if ! command -v husky &> /dev/null; then
    echo "📦 Installing husky..."
    npm install --save-dev husky
fi

# Initialize husky if not already done
if [ ! -d ".husky" ]; then
    echo "🐕 Initializing husky..."
    npx husky install
fi

# Make sure our pre-commit hook is executable
chmod +x .husky/pre-commit

# Make sure our type checker script is executable
chmod +x scripts/check-type-duplicates.cjs

echo "✅ Pre-commit hooks set up successfully!"
echo ""
echo "🎯 What this does:"
echo "   • Before each commit, checks for type duplications"
echo "   • Blocks commits that introduce new type duplications"
echo "   • Helps maintain clean type architecture"
echo ""
echo "🔍 To manually check for duplications:"
echo "   node scripts/check-type-duplicates.cjs"
echo ""
echo "🚫 To bypass pre-commit checks (not recommended):"
echo "   git commit --no-verify" 