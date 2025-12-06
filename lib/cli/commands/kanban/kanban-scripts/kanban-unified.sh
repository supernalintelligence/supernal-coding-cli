#!/bin/bash

# Unified Kanban CLI System
# Single command interface for all kanban operations
# Inspired by task-master CLI design

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script directory and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Get kanban directory from config
if [[ -f "$PROJECT_ROOT/scripts/config-loader.js" ]]; then
    KANBAN_DIR=$(node -e "
        const { getConfig } = require('$PROJECT_ROOT/scripts/config-loader');
        const config = getConfig('$PROJECT_ROOT');
        config.load();
        console.log('$PROJECT_ROOT/' + config.getKanbanBaseDirectory());
    " 2>/dev/null || echo "$PROJECT_ROOT/docs/planning/kanban")
else
    KANBAN_DIR="$PROJECT_ROOT/docs/planning/kanban"
fi

TEMPLATES_DIR="$SCRIPT_DIR/templates"

# Configuration
VERBOSE=false
DRY_RUN=false
AUTO_ORGANIZE=true
MAX_BACKUPS=5

# Version information
KANBAN_VERSION="2.0.0"

# Show usage
show_usage() {
    echo -e "${BOLD}Kanban Unified CLI v${KANBAN_VERSION}${NC}"
    echo "Single interface for all kanban operations"
    echo ""
    echo -e "${BOLD}Usage:${NC} kanban [options] <command> [args...]"
    echo ""
    echo -e "${BOLD}Core Commands:${NC}"
    echo -e "  ${GREEN}list${NC} [type]              List tasks (all, todo, doing, blocked, done, handoffs)"
    echo -e "  ${GREEN}stats${NC}                    Show task statistics and overview"
    echo -e "  ${GREEN}new${NC} <type> <name>        Create new task from template"
    echo -e "  ${GREEN}move${NC} <file> <state>      Move task between states"
    echo -e "  ${GREEN}search${NC} <query>           Search across all kanban items"
    echo ""
    echo -e "${BOLD}Natural Language:${NC}"
    echo -e "  ${GREEN}brainstorm${NC} <description>  Create brainstorm item"
    echo -e "  ${GREEN}todo${NC} <description>       Create todo task"
    echo -e "  ${GREEN}doing${NC} <description>      Create active task"
    echo -e "  ${GREEN}blocked${NC} <description>    Create blocked task"
    echo -e "  ${GREEN}handoff${NC} <description>    Create handoff task"
    echo ""
    echo -e "${BOLD}Priority Management:${NC}"
    echo -e "  ${GREEN}priority${NC} next            Show next task by priority"
    echo -e "  ${GREEN}priority${NC} list [filter]   List tasks by priority"
    echo -e "  ${GREEN}priority${NC} stats           Show priority statistics"
    echo ""
    echo -e "${BOLD}System Management:${NC}"
    echo -e "  ${GREEN}init${NC}                     Initialize kanban structure"
    echo -e "  ${GREEN}organize${NC}                 Auto-organize and validate structure"
    echo -e "  ${GREEN}cleanup${NC}                  Archive old items and clean up"
    echo -e "  ${GREEN}update${NC}                   Update system to latest version"
    echo ""
    echo -e "${BOLD}Options:${NC}"
    echo -e "  ${YELLOW}-v, --verbose${NC}           Show detailed output"
    echo -e "  ${YELLOW}-n, --dry-run${NC}           Show what would be done without executing"
    echo -e "  ${YELLOW}--no-organize${NC}           Skip automatic organization"
    echo -e "  ${YELLOW}-h, --help${NC}              Show this help message"
    echo -e "  ${YELLOW}--version${NC}               Show version information"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo -e "  kanban list"
    echo -e "  kanban todo implement user authentication priority 1"
    echo -e "  kanban brainstorm self-creating CSV products"
    echo -e "  kanban priority next"
    echo -e "  kanban move docs/planning/kanban/TODO/P1_task.md doing"
    echo -e "  kanban search authentication"
}

# Auto-organize function
auto_organize() {
    if [ "$AUTO_ORGANIZE" = true ] && [ -f "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" ]; then
        if [ "$VERBOSE" = true ]; then
            echo -e "${BLUE}🔄 Auto-organizing files...${NC}"
            bash "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" fix .
        else
            # Run silently by redirecting output
            bash "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" fix . >/dev/null 2>&1 || true
        fi
    fi
}

# Initialize kanban structure
kanban_init() {
    echo -e "${BLUE}🏗️  Initializing Kanban structure...${NC}"
    
    # Create main directories
    mkdir -p "$KANBAN_DIR"/{BRAINSTORM,PLANNING,TODO,DOING,BLOCKED,DONE,HANDOFFS}
    mkdir -p "$KANBAN_DIR"/{BRAINSTORM,PLANNING,TODO,DOING,BLOCKED,DONE,HANDOFFS}/ARCHIVE
    mkdir -p "$TEMPLATES_DIR"
    
    # Create README if it doesn't exist
    if [ ! -f "$KANBAN_DIR/README.md" ]; then
        cat > "$KANBAN_DIR/README.md" << 'EOF'
# Kanban System

This directory contains the kanban task management system.

## Structure

- **BRAINSTORM/**: Ideas and exploration
- **PLANNING/**: Planning and scoping tasks  
- **TODO/**: Ready to work tasks
- **DOING/**: In progress work
- **BLOCKED/**: Blocked tasks
- **DONE/**: Completed tasks
- **HANDOFFS/**: Agent/developer handoffs

## Usage

Use the `kanban` command to interact with this system:

```bash
kanban list              # Show all tasks
kanban todo "new task"   # Create new task
kanban priority next     # Show next priority task
```

See `kanban --help` for full documentation.
EOF
    fi
    
    echo -e "${GREEN}✅ Kanban system initialized${NC}"
}

# List tasks with filtering
kanban_list() {
    local filter="$1"
    
    echo -e "${BOLD}📋 Kanban Overview${NC}"
    echo "=================="
    
    # Immediate tasks (quick tasks)
    if [[ -z "$filter" || "$filter" == "immediate" || "$filter" == "all" ]]; then
        echo -e "\n${PURPLE}⚡ IMMEDIATE:${NC}"
        if [[ -d "$KANBAN_DIR/immediate/todos" ]]; then
            ls "$KANBAN_DIR/immediate/todos"/*.md 2>/dev/null | sed 's/.*\///; s/.md$/  - /' | sort || echo "  (none)"
        else
            echo "  (none)"
        fi
    fi
    
    # Main tasks
    if [[ -z "$filter" || "$filter" == "todo" || "$filter" == "all" ]]; then
        echo -e "\n${BLUE}📋 TODO:${NC}"
        if [[ -d "$KANBAN_DIR/tasks/todo" ]]; then
            ls "$KANBAN_DIR/tasks/todo"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        fi
        if [[ -d "$KANBAN_DIR/TODO" ]]; then
            ls "$KANBAN_DIR/TODO"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        fi
        if [[ ! -d "$KANBAN_DIR/tasks/todo" ]] && [[ ! -d "$KANBAN_DIR/TODO" ]]; then
            echo "  (none)"
        fi
    fi
    
    if [[ -z "$filter" || "$filter" == "doing" || "$filter" == "all" ]]; then
        echo -e "\n${GREEN}🏃 DOING:${NC}"
        if [[ -d "$KANBAN_DIR/tasks/doing" ]]; then
            ls "$KANBAN_DIR/tasks/doing"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        elif [[ -d "$KANBAN_DIR/DOING" ]]; then
            ls "$KANBAN_DIR/DOING"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        else
            echo "  (none)"
        fi
        
        # Include handoffs in doing (since handoffs are active work)
        if [[ -d "$KANBAN_DIR/handoffs" ]]; then
            ls "$KANBAN_DIR/handoffs"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        fi
    fi
    
    if [[ -z "$filter" || "$filter" == "blocked" || "$filter" == "all" ]]; then
        echo -e "\n${RED}🚫 BLOCKED:${NC}"
        if [[ -d "$KANBAN_DIR/tasks/blocked" ]]; then
            ls "$KANBAN_DIR/tasks/blocked"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        elif [[ -d "$KANBAN_DIR/BLOCKED" ]]; then
            ls "$KANBAN_DIR/BLOCKED"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        else
            echo "  (none)"
        fi
    fi
    
    if [[ -z "$filter" || "$filter" == "review" || "$filter" == "all" ]]; then
        echo -e "\n${YELLOW}👀 REVIEW:${NC}"
        if [[ -d "$KANBAN_DIR/tasks/review" ]]; then
            ls "$KANBAN_DIR/tasks/review"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        else
            echo "  (none)"
        fi
    fi
    
    if [[ -z "$filter" || "$filter" == "done" || "$filter" == "all" ]]; then
        echo -e "\n${GREEN}✅ DONE:${NC}"
        if [[ -d "$KANBAN_DIR/tasks/done" ]]; then
            ls "$KANBAN_DIR/tasks/done"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        elif [[ -d "$KANBAN_DIR/DONE" ]]; then
            ls "$KANBAN_DIR/DONE"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        else
            echo "  (none)"
        fi
        
        # Immediate done tasks
        if [[ -d "$KANBAN_DIR/immediate/done" ]]; then
            ls "$KANBAN_DIR/immediate/done"/*.md 2>/dev/null | sed 's/.*\///; s/$/  - /' | sort || echo "  (none)"
        fi
    fi
    
    # Epics
    if [[ -z "$filter" || "$filter" == "epics" || "$filter" == "all" ]]; then
        if [[ -d "$KANBAN_DIR/epics" ]]; then
            echo -e "\n${PURPLE}📚 EPICS:${NC}"
            for epic_dir in "$KANBAN_DIR/epics"/*/; do
                if [[ -d "$epic_dir" ]]; then
                    epic_name=$(basename "$epic_dir")
                    echo -e "  📖 ${epic_name}:"
                    
                    # Epic overview
                    if [[ -f "$epic_dir/epic-overview.md" ]]; then
                        echo "    - epic-overview.md"
                    fi
                    
                    # Tasks
                    if [[ -d "$epic_dir/tasks" ]]; then
                        for task_file in "$epic_dir/tasks"/*.md; do
                            if [[ -f "$task_file" ]]; then
                                task_name=$(basename "$task_file")
                                echo "    - tasks/$task_name"
                            fi
                        done
                    fi
                    
                    # Requirements
                    if [[ -d "$epic_dir/requirements" ]]; then
                        for req_file in "$epic_dir/requirements"/*.md; do
                            if [[ -f "$req_file" ]]; then
                                req_name=$(basename "$req_file")
                                echo "    - requirements/$req_name"
                            fi
                        done
                    fi
                fi
            done
        fi
    fi
    
}

# Show statistics
kanban_stats() {
    echo -e "${BOLD}📊 Kanban Statistics${NC}"
    echo "==================="
    
    local brainstorm_count=$(ls "$KANBAN_DIR/BRAINSTORM"/*.md 2>/dev/null | wc -l)
    local planning_count=$(ls "$KANBAN_DIR/PLANNING"/*.md 2>/dev/null | wc -l)
    local todo_count=$(ls "$KANBAN_DIR/TODO"/*.md 2>/dev/null | wc -l)
    local doing_count=$(ls "$KANBAN_DIR/DOING"/*.md 2>/dev/null | wc -l)
    local blocked_count=$(ls "$KANBAN_DIR/BLOCKED"/*.md 2>/dev/null | wc -l)
    local done_count=$(ls "$KANBAN_DIR/DONE"/*.md 2>/dev/null | wc -l)
    local handoff_count=$(ls "$KANBAN_DIR/HANDOFFS"/*.md 2>/dev/null | wc -l)
    
    echo -e "${PURPLE}💡 Brainstorming: $brainstorm_count${NC}"
    echo -e "${YELLOW}📋 Planning:      $planning_count${NC}"  
    echo -e "${BLUE}📋 TODO:         $todo_count${NC}"
    echo -e "${GREEN}🏃 Doing:        $doing_count${NC}"
    echo -e "${RED}🚫 Blocked:      $blocked_count${NC}"
    echo -e "${GREEN}✅ Done:         $done_count${NC}"
    echo -e "${CYAN}🚀 Handoffs:     $handoff_count${NC}"
    
    echo ""
    local total_active=$((todo_count + doing_count + blocked_count))
    echo -e "${BOLD}Total Active Work: $total_active${NC}"
    
    # Priority breakdown for TODO and BLOCKED
    if [ "$todo_count" -gt 0 ] || [ "$blocked_count" -gt 0 ]; then
        echo ""
        echo -e "${BOLD}Priority Breakdown:${NC}"
        for priority in 0 1 2 3 4; do
            local count=0
            count=$((count + $(ls "$KANBAN_DIR/TODO"/P${priority}_*.md 2>/dev/null | wc -l)))
            count=$((count + $(ls "$KANBAN_DIR/BLOCKED"/P${priority}_*.md 2>/dev/null | wc -l)))
            if [ "$count" -gt 0 ]; then
                echo -e "  Priority $priority: $count tasks"
            fi
        done
    fi
}

# Natural language interface
kanban_natural() {
    local type="$1"
    shift
    local description="$*"
    
    if [ -z "$description" ]; then
        echo -e "${RED}❌ Usage: kanban $type <description>${NC}"
        exit 1
    fi
    
    # Extract priority if mentioned
    local priority=2
    if [[ "$description" =~ priority[[:space:]]+([0-4]) ]]; then
        priority=${BASH_REMATCH[1]}
        description=$(echo "$description" | sed 's/priority[[:space:]]*[0-4]//g' | sed 's/  */ /g' | sed 's/^ *//' | sed 's/ *$//')
    fi
    
    # Generate filename
    local task_name=$(echo "$description" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    if [ ${#task_name} -gt 50 ]; then
        task_name=$(echo "$task_name" | cut -c1-47)...
    fi
    
    case "$type" in
        "brainstorm")
            local file="$KANBAN_DIR/BRAINSTORM/${task_name}.md"
            ;;
        "planning")
            local file="$KANBAN_DIR/PLANNING/${task_name}.md"
            ;;
        "todo")
            local file="$KANBAN_DIR/TODO/P${priority}_${task_name}.md"
            ;;
        "doing")
            local file="$KANBAN_DIR/DOING/${task_name}.md"
            ;;
        "blocked")
            local file="$KANBAN_DIR/BLOCKED/P${priority}_${task_name}.md"
            ;;
        "handoff")
            local file="$KANBAN_DIR/HANDOFFS/${task_name}.md"
            ;;
        *)
            echo -e "${RED}❌ Unknown task type: $type${NC}"
            exit 1
            ;;
    esac
    
    # Create the file with basic template
    if [ -f "$file" ]; then
        echo -e "${YELLOW}⚠️  Task already exists: $(basename "$file")${NC}"
    else
        mkdir -p "$(dirname "$file")"
        
        cat > "$file" << EOF
# $(echo "$type" | tr '[:lower:]' '[:upper:]'): $description

**Created**: $(date +%Y-%m-%d)  
**Status**: $(echo "$type" | sed 's/^./\U&/')  
**Priority**: P$priority

---

## 📋 Description

$description

## 📝 Notes

[Add your notes here]

## ✅ Completion Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

*Created with kanban unified CLI v${KANBAN_VERSION}*
EOF
        
        echo -e "${GREEN}✅ Created: $(basename "$file")${NC}"
        
        # Auto-organize if enabled
        auto_organize
    fi
}

# Priority management
priority_command() {
    local subcmd="$1"
    shift
    
    case "$subcmd" in
        "next")
            echo -e "${BOLD}🎯 Next Priority Task${NC}"
            echo "==================="
            
            # Find highest priority task that's not blocked
            for priority in 0 1 2 3 4; do
                local task=$(ls "$KANBAN_DIR/TODO"/P${priority}_*.md 2>/dev/null | head -1)
                if [ -f "$task" ]; then
                    local filename=$(basename "$task" .md)
                    local task_name=$(echo "$filename" | sed "s/P${priority}_//")
                    echo -e "${GREEN}📋 Priority $priority: $task_name${NC}"
                    echo -e "${BLUE}File: $task${NC}"
                    return
                fi
            done
            echo -e "${YELLOW}No TODO tasks found${NC}"
            ;;
        "list")
            local filter="$1"
            echo -e "${BOLD}📋 Tasks by Priority${NC}"
            echo "===================="
            
            for priority in 0 1 2 3 4; do
                if [[ -z "$filter" || "$filter" == "$priority" ]]; then
                    echo -e "\n${BOLD}Priority $priority:${NC}"
                    ls "$KANBAN_DIR/TODO"/P${priority}_*.md 2>/dev/null | sed 's/.*P[0-4]_//; s/.md$/  - /' | sort || echo "  (none)"
                    ls "$KANBAN_DIR/BLOCKED"/P${priority}_*.md 2>/dev/null | sed 's/.*P[0-4]_//; s/.md$/  - (BLOCKED)/' | sort
                fi
            done
            ;;
        "stats")
            echo -e "${BOLD}📊 Priority Statistics${NC}"
            echo "====================="
            
            for priority in 0 1 2 3 4; do
                local todo_count=$(ls "$KANBAN_DIR/TODO"/P${priority}_*.md 2>/dev/null | wc -l)
                local blocked_count=$(ls "$KANBAN_DIR/BLOCKED"/P${priority}_*.md 2>/dev/null | wc -l)
                local total=$((todo_count + blocked_count))
                
                if [ "$total" -gt 0 ]; then
                    echo -e "Priority $priority: $total tasks ($todo_count todo, $blocked_count blocked)"
                fi
            done
            ;;
        *)
            echo -e "${RED}❌ Unknown priority command: $subcmd${NC}"
            echo -e "${BLUE}Available: next, list [priority], stats${NC}"
            exit 1
            ;;
    esac
}

# Move task between states
kanban_move() {
    local source_file="$1"
    local target_state="$2"
    
    if [[ -z "$source_file" || -z "$target_state" ]]; then
        echo -e "${RED}❌ Usage: kanban move <file> <state>${NC}"
        echo -e "${BLUE}States: todo, doing, blocked, done, handoffs, planning${NC}"
        exit 1
    fi
    
    # Resolve full path if relative
    if [[ ! "$source_file" =~ ^/ ]]; then
        source_file="$PWD/$source_file"
    fi
    
    if [[ ! -f "$source_file" ]]; then
        echo -e "${RED}❌ File not found: $source_file${NC}"
        exit 1
    fi
    
    # Determine target directory
    case "$target_state" in
        "todo")
            target_dir="$KANBAN_DIR/TODO"
            ;;
        "doing")
            target_dir="$KANBAN_DIR/DOING"
            ;;
        "blocked")
            target_dir="$KANBAN_DIR/BLOCKED"
            ;;
        "done")
            target_dir="$KANBAN_DIR/DONE"
            ;;
        "handoffs")
            target_dir="$KANBAN_DIR/HANDOFFS"
            ;;
        "planning")
            target_dir="$KANBAN_DIR/PLANNING"
            ;;
        *)
            echo -e "${RED}❌ Invalid state: $target_state${NC}"
            echo -e "${BLUE}Valid states: todo, doing, blocked, done, handoffs, planning${NC}"
            exit 1
            ;;
    esac
    
    local filename=$(basename "$source_file")
    local target_file="$target_dir/$filename"
    
    # Create target directory if needed
    mkdir -p "$target_dir"
    
    # Move the file
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}[DRY RUN] Would move: $source_file → $target_file${NC}"
    else
        mv "$source_file" "$target_file"
        echo -e "${GREEN}✅ Moved: $(basename "$filename") → $target_state${NC}"
        
        # Auto-organize if enabled
        auto_organize
    fi
}

# Search across kanban items
kanban_search() {
    local query="$1"
    
    if [[ -z "$query" ]]; then
        echo -e "${RED}❌ Usage: kanban search <query>${NC}"
        exit 1
    fi
    
    echo -e "${BOLD}🔍 Search Results for: '$query'${NC}"
    echo "=================================="
    
    # Search in all kanban directories
    local found=false
    for dir in "$KANBAN_DIR"/*; do
        if [[ -d "$dir" ]]; then
            local state=$(basename "$dir")
            local matches=$(grep -l -i "$query" "$dir"/*.md 2>/dev/null || true)
            
            if [[ -n "$matches" ]]; then
                echo -e "\n${BOLD}📂 $state:${NC}"
                echo "$matches" | while read -r file; do
                    if [[ -f "$file" ]]; then
                        local filename=$(basename "$file" .md)
                        local preview=$(grep -i "$query" "$file" | head -1 | sed 's/^[#* ]*//g' | cut -c1-60)
                        echo -e "  📄 $filename"
                        if [[ -n "$preview" ]]; then
                            echo -e "     ${GRAY}$preview...${NC}"
                        fi
                        found=true
                    fi
                done
            fi
        fi
    done
    
    if [[ "$found" == "false" ]]; then
        echo -e "${YELLOW}No matches found for '$query'${NC}"
    fi
}

# Cleanup old items
kanban_cleanup() {
    echo -e "${BLUE}🧹 Cleaning up kanban items...${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}[DRY RUN] Cleanup operations:${NC}"
    fi
    
    # Archive old DONE items (older than 30 days)
    local archive_dir="$KANBAN_DIR/DONE/ARCHIVE"
    mkdir -p "$archive_dir"
    
    find "$KANBAN_DIR/DONE" -name "*.md" -mtime +30 -maxdepth 1 | while read -r file; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            if [[ "$DRY_RUN" == "true" ]]; then
                echo -e "  Would archive: $filename"
            else
                mv "$file" "$archive_dir/"
                echo -e "${GREEN}📦 Archived: $filename${NC}"
            fi
        fi
    done
    
    # Clean up empty directories
    find "$KANBAN_DIR" -type d -empty | while read -r dir; do
        if [[ "$dir" != "$KANBAN_DIR" ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                echo -e "  Would remove empty directory: $(basename "$dir")"
            else
                rmdir "$dir" 2>/dev/null || true
            fi
        fi
    done
    
    # Run organize script if available
    if [[ -f "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            echo -e "  Would run kanban-organize cleanup"
        else
            bash "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" clean-backups .
        fi
    fi
    
    if [[ "$DRY_RUN" != "true" ]]; then
        echo -e "${GREEN}✅ Cleanup completed${NC}"
    fi
}

# System update
system_update() {
    echo -e "${BLUE}🔄 Updating kanban system...${NC}"
    
    if [ -f "$PROJECT_ROOT/kanban-meta-update" ]; then
        "$PROJECT_ROOT/kanban-meta-update" update
    else
        echo -e "${YELLOW}⚠️  Meta-update script not found${NC}"
        echo -e "${BLUE}Manual update required${NC}"
    fi
}

# Main argument parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-organize)
            AUTO_ORGANIZE=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        --version)
            echo "Kanban Unified CLI v${KANBAN_VERSION}"
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# Command dispatch
case "${1:-help}" in
    "init")
        kanban_init
        ;;
    "list"|"ls")
        kanban_list "$2"
        ;;
    "stats")
        kanban_stats
        ;;
    "brainstorm"|"todo"|"doing"|"blocked"|"handoff"|"planning")
        kanban_natural "$@"
        ;;
    "priority")
        shift
        priority_command "$@"
        ;;
    "move")
        shift
        kanban_move "$@"
        ;;
    "search")
        shift
        kanban_search "$@"
        ;;
    "cleanup")
        kanban_cleanup
        ;;
    "organize")
        if [ -f "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" ]; then
            bash "$PROJECT_ROOT/scripts/project-management/kanban-organize.sh" organize
        else
            echo -e "${YELLOW}⚠️  Organize script not found${NC}"
        fi
        ;;
    "update")
        system_update
        ;;
    "help"|*)
        show_usage
        ;;
esac

# Auto-organize at the end if enabled
auto_organize 