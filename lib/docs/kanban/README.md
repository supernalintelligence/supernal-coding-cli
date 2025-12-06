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
