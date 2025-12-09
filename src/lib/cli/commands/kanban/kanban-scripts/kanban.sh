#!/bin/bash

# Legacy Kanban CLI - Redirects to Unified System
# This maintains backward compatibility while using the new unified interface

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Call the unified kanban system
exec "$SCRIPT_DIR/kanban-unified.sh" "$@" 