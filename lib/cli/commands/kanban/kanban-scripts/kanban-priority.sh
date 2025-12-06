#!/bin/bash

# Kanban Priority Management Script
# Manages task priorities and provides priority-based operations

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

# Try to load config using the config loader
if [ -f "$PROJECT_ROOT/scripts/config-loader.js" ]; then
  KANBAN_DIR=$(node "$PROJECT_ROOT/scripts/config-loader.js" kanban_dir 2>/dev/null || echo "supernal-coding/kanban")
else
  KANBAN_DIR="supernal-coding/kanban"
fi

# Support both old flat structure and new nested structure
if [ -d "$PROJECT_ROOT/$KANBAN_DIR/tasks" ]; then
  # New nested structure
  TODO_DIR="$KANBAN_DIR/tasks/todo"
  DOING_DIR="$KANBAN_DIR/tasks/doing"
  BLOCKED_DIR="$KANBAN_DIR/tasks/blocked"
else
  # Old flat structure
  TODO_DIR="$KANBAN_DIR/TODO"
  DOING_DIR="$KANBAN_DIR/DOING"
  BLOCKED_DIR="$KANBAN_DIR/BLOCKED"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# List tasks by priority
kanban_list_by_priority() {
  echo -e "${RED}🔥 P0 - Critical:${NC}"
  ls "$TODO_DIR"/P0_* 2>/dev/null | sed 's/.*P0_/  - /' | sed 's/.md$//' || echo "  (none)"
  
  echo -e "${YELLOW}🚨 P1 - High:${NC}"
  ls "$TODO_DIR"/P1_* 2>/dev/null | sed 's/.*P1_/  - /' | sed 's/.md$//' || echo "  (none)"
  
  echo -e "${BLUE}📋 P2 - Medium:${NC}"
  ls "$TODO_DIR"/P2_* 2>/dev/null | sed 's/.*P2_/  - /' | sed 's/.md$//' || echo "  (none)"
  
  echo -e "${GREEN}📝 P3 - Low:${NC}"
  ls "$TODO_DIR"/P3_* 2>/dev/null | sed 's/.*P3_/  - /' | sed 's/.md$//' || echo "  (none)"
  
  echo -e "${PURPLE}📦 P4 - Backlog:${NC}"
  ls "$TODO_DIR"/P4_* 2>/dev/null | sed 's/.*P4_/  - /' | sed 's/.md$//' || echo "  (none)"
}

# Change task priority
kanban_change_priority() {
  local old_file=$1
  local new_priority=$2
  
  if [ ! -f "$old_file" ]; then
    echo "❌ File not found: $old_file"
    return 1
  fi
  
  if [[ ! "$new_priority" =~ ^[0-4]$ ]]; then
    echo "❌ Priority must be 0-4"
    return 1
  fi
  
  local new_file=$(echo "$old_file" | sed "s/P[0-4]_/P${new_priority}_/")
  
  mv "$old_file" "$new_file"
  echo "✅ Priority changed: $(basename "$old_file") → $(basename "$new_file")"
  
  # Update priority in file content
  sed -i.bak "s/\*\*Priority\*\*: P[0-4]/\*\*Priority\*\*: P${new_priority}/" "$new_file"
  rm "$new_file.bak" 2>/dev/null || true
}

# Get next task to work on
kanban_next_task() {
  local next_p0=$(ls "$TODO_DIR"/P0_* 2>/dev/null | head -1)
  local next_p1=$(ls "$TODO_DIR"/P1_* 2>/dev/null | head -1)
  local next_p2=$(ls "$TODO_DIR"/P2_* 2>/dev/null | head -1)
  
  if [ -n "$next_p0" ]; then
    echo -e "${RED}🔥 Next task (P0 - CRITICAL): $(basename "$next_p0" .md | sed 's/P0_//')${NC}"
    echo -e "${BLUE}📂 File: $next_p0${NC}"
    echo -e "${YELLOW}⚡ Action: Start immediately - this is blocking!${NC}"
  elif [ -n "$next_p1" ]; then
    echo -e "${YELLOW}🚨 Next task (P1 - HIGH): $(basename "$next_p1" .md | sed 's/P1_//')${NC}"
    echo -e "${BLUE}📂 File: $next_p1${NC}"
    echo -e "${GREEN}👍 Action: Good choice for next task${NC}"
  elif [ -n "$next_p2" ]; then
    echo -e "${BLUE}📋 Next task (P2 - MEDIUM): $(basename "$next_p2" .md | sed 's/P2_//')${NC}"
    echo -e "${BLUE}📂 File: $next_p2${NC}"
    echo -e "${GREEN}✅ Action: Standard priority task${NC}"
  else
    echo -e "${GREEN}✅ No high-priority tasks remaining${NC}"
    echo -e "${PURPLE}📦 Check P3/P4 tasks or add new work${NC}"
  fi
}

# Show priority statistics
kanban_priority_stats() {
  local p0_count=$(ls "$TODO_DIR"/P0_* 2>/dev/null | wc -l)
  local p1_count=$(ls "$TODO_DIR"/P1_* 2>/dev/null | wc -l)
  local p2_count=$(ls "$TODO_DIR"/P2_* 2>/dev/null | wc -l)
  local p3_count=$(ls "$TODO_DIR"/P3_* 2>/dev/null | wc -l)
  local p4_count=$(ls "$TODO_DIR"/P4_* 2>/dev/null | wc -l)
  local doing_count=$(ls "$DOING_DIR"/*.md 2>/dev/null | wc -l)
  local blocked_count=$(ls "$BLOCKED_DIR"/*.md 2>/dev/null | wc -l)
  
  echo "📊 Priority Statistics"
  echo "===================="
  echo -e "${RED}P0 Critical:  $p0_count${NC}"
  echo -e "${YELLOW}P1 High:      $p1_count${NC}"
  echo -e "${BLUE}P2 Medium:    $p2_count${NC}"
  echo -e "${GREEN}P3 Low:       $p3_count${NC}"
  echo -e "${PURPLE}P4 Backlog:   $p4_count${NC}"
  echo ""
  echo -e "${BLUE}🏃 In Progress: $doing_count${NC}"
  echo -e "${RED}🚫 Blocked:     $blocked_count${NC}"
  echo ""
  
  # Health indicators
  if [ "$p0_count" -gt 3 ]; then
    echo -e "${RED}⚠️  WARNING: Too many P0 tasks ($p0_count > 3)${NC}"
  fi
  
  if [ "$p1_count" -gt 5 ]; then
    echo -e "${YELLOW}⚠️  CAUTION: High P1 backlog ($p1_count > 5)${NC}"
  fi
  
  if [ "$doing_count" -gt 3 ]; then
    echo -e "${YELLOW}⚠️  CAUTION: Too much work in progress ($doing_count > 3)${NC}"
  fi
  
  if [ "$blocked_count" -gt 2 ]; then
    echo -e "${RED}⚠️  WARNING: Too many blocked tasks ($blocked_count > 2)${NC}"
  fi
}

# Bulk priority operations
kanban_bulk_reprioritize() {
  local old_priority=$1
  local new_priority=$2
  
  if [[ ! "$old_priority" =~ ^[0-4]$ ]] || [[ ! "$new_priority" =~ ^[0-4]$ ]]; then
    echo "❌ Priorities must be 0-4"
    return 1
  fi
  
  local count=0
  for file in "$TODO_DIR"/P${old_priority}_*; do
    if [ -f "$file" ]; then
      kanban_change_priority "$file" "$new_priority"
      ((count++))
    fi
  done
  
  echo "✅ Reprioritized $count tasks from P$old_priority to P$new_priority"
}

# Main command dispatcher
case "${1:-help}" in
  "list"|"ls")
    kanban_list_by_priority
    ;;
  "next")
    kanban_next_task
    ;;
  "stats")
    kanban_priority_stats
    ;;
  "change")
    if [ $# -ne 3 ]; then
      echo "Usage: $0 change <file> <new_priority>"
      echo "Example: $0 change docs/planning/kanban/TODO/P3_task-name.md 1"
      exit 1
    fi
    kanban_change_priority "$2" "$3"
    ;;
  "bulk")
    if [ $# -ne 3 ]; then
      echo "Usage: $0 bulk <old_priority> <new_priority>"
      echo "Example: $0 bulk 3 2"
      exit 1
    fi
    kanban_bulk_reprioritize "$2" "$3"
    ;;
  "help"|*)
    echo "Kanban Priority Management"
    echo "========================="
    echo ""
    echo "Commands:"
    echo "  list, ls     - List all tasks by priority"
    echo "  next         - Show next recommended task"
    echo "  stats        - Show priority statistics and health"
    echo "  change       - Change single task priority"
    echo "  bulk         - Change all tasks of one priority to another"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 next"
    echo "  $0 stats"
    echo "  $0 change docs/planning/kanban/TODO/P3_task.md 1"
    echo "  $0 bulk 3 2"
    ;;
esac 