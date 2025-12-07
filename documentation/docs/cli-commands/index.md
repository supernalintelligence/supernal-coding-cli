---
title: CLI Commands Overview
sidebar_label: Overview
sidebar_position: 1
slug: /cli-commands
---

# Supernal Coding CLI Commands

*Generated: 2025-12-03T07:08:10.697Z • 23 commands*

All commands can be run with either `sc` or `supernal-coding` prefix.

## Available Commands

| Command | Description | SOPs |
|---------|-------------|------|
| [`sc cli`](./cli) | CLI introspection and workflow mapping | 1 |
| [`sc config`](./config) | Configuration management | 0 |
| [`sc dashboard`](./dashboard) | Dashboard management for requirements visualization | 0 |
| [`sc docs`](./docs) | Documentation management | 5 |
| [`sc fbc`](./fbc) | Manage feature registry for feature-based commits | 1 |
| [`sc feature`](./feature) | Manage features in the feature-by-phase system | 1 |
| [`sc git-hooks`](./git-hooks) | Manage git hooks | 5 |
| [`sc git-smart`](./git-smart) | Git workflow automation | 12 |
| [`sc health`](./health) | System health checks (features, all) | 0 |
| [`sc init`](./init) | Equip repository with Supernal Coding | 2 |
| [`sc multi-repo`](./multi-repo) | Multi-repository management | 0 |
| [`sc requirement`](./requirement) | Manage requirements | 4 |
| [`sc rules`](./rules) | Rule management | 1 |
| [`sc sync`](./sync) | Synchronize with upstream repository or global installation | 0 |
| [`sc telemetry`](./telemetry) | Manage telemetry and usage insights | 0 |
| [`sc template`](./template) | Template management | 0 |
| [`sc test`](./test) | Run test guidance and mapping | 1 |
| [`sc traceability`](./traceability) | Traceability matrix for compliance and requirement tracking | 2 |
| [`sc type-check`](./type-check) | Detect and prevent TypeScript/JavaScript type duplications | 2 |
| [`sc upgrade`](./upgrade) | Upgrade SC templates and rules to latest version | 0 |
| [`sc validate`](./validate) | Validate current installation | 3 |
| [`sc wip`](./wip) | Manage work-in-progress files via WIP registry | 2 |
| [`sc workflow`](./workflow) | Workflow state management | 0 |

## Quick Start

```bash
# Get help for any command
sc <command> --help

# Common workflow
sc requirement new "Feature title" --epic=my-epic
sc requirement validate REQ-XXX
sc git-smart branch --branch REQ-XXX
sc git-smart merge --push --delete-local
```

## Regenerating Documentation

```bash
# Regenerate all command docs
sc cli generate-docs

# Custom output directory
sc cli generate-docs --output docs/cli
```

---

*This documentation is auto-generated from the CLI source code.*