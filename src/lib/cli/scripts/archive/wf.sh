#!/bin/bash
# Supernal Coding Workflow Shortcut Script
# Usage: ./wf.sh <command> [args...]

# Run the workflow command
exec node cli/index.js workflow "$@" 