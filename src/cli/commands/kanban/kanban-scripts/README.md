# Kanban Management System v2.0.0

A unified CLI for managing project tasks across development phases using a simple kanban-style board. Streamlines development workflow with automated organization and priority management.

## 🚀 Quick Start

```bash
# Install in a repository
curl -O https://raw.githubusercontent.com/your-org/supernal-nova/main/scripts/project-management/kanban/install-kanban.sh
chmod +x install-kanban.sh
./install-kanban.sh

# Basic usage
./kanban list              # Show all tasks
./kanban new todo "task"   # Create new task
./kanban move "task" doing # Move task to doing
./kanban done "task"       # Mark task complete
```

## 📦 Installation

### For New Repositories

```bash
# One-line install
curl -sL https://raw.githubusercontent.com/your-org/supernal-nova/main/scripts/project-management/kanban/install-kanban.sh | bash

# Or manual install
curl -O https://raw.githubusercontent.com/your-org/supernal-nova/main/scripts/project-management/kanban/install-kanban.sh
chmod +x install-kanban.sh
./install-kanban.sh
```

### For Existing Repositories

```bash
# Check version and updates
./kanban --version
./scripts/project-management/kanban/check-version.sh

# Update if needed
./install-kanban.sh  # Will detect existing installation
```

## 🗂️ System Overview

### Kanban Boards

- **📋 PLANNING**: Ideas being refined into actionable tasks
- **📋 TODO**: Ready to work on, prioritized (P0-P4)
- **🏃 DOING**: Currently in progress
- **🚫 BLOCKED**: Waiting on dependencies/decisions
- **✅ DONE**: Completed work with timestamps
- **🚀 HANDOFFS**: Work ready for team transfer

### Priority System

- **P0**: Critical/blocking issues
- **P1**: High priority features/fixes
- **P2**: Standard features
- **P3**: Nice to have
- **P4**: Future considerations

## Commands

### Core Commands

```bash
./kanban list                    # Show kanban overview
./kanban new <type> "title"      # Create new task
./kanban move "task" <type>      # Move task between boards
./kanban done "task"             # Mark task complete
./kanban search "keyword"        # Find tasks by keyword
./kanban priority               # Show priority-ordered tasks
```

### Task Types

- `todo` - Ready to work on
- `doing` - In progress
- `blocked` - Waiting on something
- `planning` - Being refined
- `handoff` - Ready for transfer
- `done` - Completed

### Advanced Commands

```bash
./kanban cleanup                # Archive old completed tasks
./kanban rename "old" "new"     # Rename task
./kanban template <type>        # Show template for task type
./kanban update                 # Update kanban system
./kanban --version             # Show current version
```

## File Structure

```
docs/planning/kanban/
├── PLANNING/          # Tasks being refined
├── TODO/              # Ready to work on
├── DOING/             # In progress
├── BLOCKED/           # Waiting on dependencies
├── DONE/              # Completed (with timestamps)
├── HANDOFFS/          # Ready for team transfer
└── README.md          # This file
```

## Task File Format

Each task is a markdown file with metadata:

```markdown
---
priority: P1
created: 2025-01-09
assignee: agent-name
dependencies: ['other-task']
---

# Task Title

## Description

What needs to be done

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Notes

Technical details and approach
```

## Integration with Development

### Git Integration

- Tasks automatically reference branches when moved to DOING
- Completed tasks can trigger branch merges
- Handoffs preserve branch state for team coordination

### Family Repository Support

- Each family repo has its own kanban instance
- Cross-repo task coordination via handoff system
- Consistent priority and status across all repos

## Best Practices

### Task Creation

- Use descriptive titles that explain the outcome
- Include acceptance criteria for clarity
- Set appropriate priority levels
- Reference related tasks/dependencies

### Progress Tracking

- Move tasks through boards as work progresses
- Update task details with implementation findings
- Use handoffs for smooth team transitions
- Archive completed work regularly

### Team Coordination

- Check HANDOFFS/ for work ready to pick up
- Update task assignee when taking ownership
- Document decisions and blockers clearly
- Use priority system for shared work queues

## Version Information

Current version: **2.0.0**

### Recent Changes

- Unified CLI interface (kanban-unified.sh)
- Cross-platform compatibility fixes
- Enhanced handoff system
- Priority-based task organization
- Template-driven task creation

## Troubleshooting

### Common Issues

- **"Command not found"**: Run `chmod +x kanban` to make executable
- **"Template missing"**: Run `./kanban template <type>` to see available templates
- **"Can't move task"**: Check that task exists with `./kanban search <keyword>`

### Getting Help

```bash
./kanban --help          # Show all commands
./kanban <command> --help # Command-specific help
```

## Contributing

To improve the kanban system:

1. Create task in PLANNING with your idea
2. Move to TODO when ready to implement
3. Use DOING while working
4. Submit handoff when ready for review
5. Move to DONE when complete

---

_System managed by kanban-unified CLI v2.0.0_
