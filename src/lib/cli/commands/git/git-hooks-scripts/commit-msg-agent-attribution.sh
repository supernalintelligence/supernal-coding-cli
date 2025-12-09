#!/bin/bash

# commit-msg-agent-attribution.sh
# Git commit-msg hook for REQ-039: Agent-Specific Commit Attribution System
# This hook automatically detects and attributes commits to AI agents

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the commit message file
COMMIT_MSG_FILE=$1

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

# Find the agent attribution script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_ATTRIBUTION_SCRIPT="$SCRIPT_DIR/../agent-attribution.js"

if [ ! -f "$AGENT_ATTRIBUTION_SCRIPT" ]; then
    echo -e "${YELLOW}⚠️  Agent attribution script not found, skipping attribution${NC}"
    exit 0
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js not found, skipping agent attribution${NC}"
    exit 0
fi

# Read the current commit message
ORIGINAL_MESSAGE=$(cat "$COMMIT_MSG_FILE")

# Skip if message already has agent attribution
if echo "$ORIGINAL_MESSAGE" | grep -q '\[.*\]'; then
    echo -e "${BLUE}ℹ️  Commit message already has attribution, skipping${NC}"
    exit 0
fi

# Skip for merge commits
if echo "$ORIGINAL_MESSAGE" | grep -q "^Merge "; then
    echo -e "${BLUE}ℹ️  Merge commit detected, skipping agent attribution${NC}"
    exit 0
fi

# Skip for revert commits
if echo "$ORIGINAL_MESSAGE" | grep -q "^Revert "; then
    echo -e "${BLUE}ℹ️  Revert commit detected, skipping agent attribution${NC}"
    exit 0
fi

# Generate attributed commit message
echo -e "${BLUE}🤖 Detecting agent and attributing commit...${NC}"

ATTRIBUTED_MESSAGE=$(node "$AGENT_ATTRIBUTION_SCRIPT" attribute "$ORIGINAL_MESSAGE" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$ATTRIBUTED_MESSAGE" ]; then
    # Write the attributed message back to the file
    echo "$ATTRIBUTED_MESSAGE" > "$COMMIT_MSG_FILE"
    echo -e "${GREEN}✅ Agent attribution applied successfully${NC}"
    
    # Show what was detected
    DETECTION_RESULT=$(node "$AGENT_ATTRIBUTION_SCRIPT" detect 2>/dev/null)
    if [ $? -eq 0 ]; then
        AGENT=$(echo "$DETECTION_RESULT" | grep -o '"agent": "[^"]*"' | cut -d'"' -f4)
        CONFIDENCE=$(echo "$DETECTION_RESULT" | grep -o '"confidence": [0-9.]*' | cut -d':' -f2 | tr -d ' ')
        
        if [ -n "$AGENT" ] && [ -n "$CONFIDENCE" ]; then
            CONFIDENCE_PERCENT=$(echo "$CONFIDENCE * 100" | bc -l 2>/dev/null | cut -d'.' -f1)
            echo -e "${BLUE}🔍 Detected: $AGENT (${CONFIDENCE_PERCENT}% confidence)${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Agent attribution failed, using original message${NC}"
fi

exit 0