# Configuration Module Pattern

## Overview

The `config.js` module provides reusable configuration management for all SC components. Component-specific commands should delegate to this module rather than implementing their own config logic.

## Core Principle

```
Component Commands → config.js → supernal.yaml
     ↓                              ↑
   Uses                          Schema
```

**DO**: Use `handleConfigCommand()` for all config operations
**DON'T**: Implement custom config reading/writing in each component

## Pattern: Component Config Integration

### Example: Git Hooks

```javascript
// supernal-code-package/lib/cli/commands/git/git-hooks.js

async showConfig(options = {}) {
  const { handleConfigCommand } = require('../config');

  // Delegate to reusable config module
  await handleConfigCommand('show', {
    section: 'git_hooks',
    ...options
  });

  // Add component-specific help
  console.log('\nCommands:');
  console.log('  sc git-hooks install');
  console.log('  sc git-hooks status');
}
```

### Benefits

1. **Single Source of Truth**: All config operations go through one module
2. **Consistent Behavior**: Same output format, error handling, backup strategy
3. **Less Code**: Components don't reimplement config logic
4. **Performance**: Config loaded once, not multiple times
5. **Extensibility**: New config features (validation, schemas, migrations) work everywhere

## Available Config Operations

```javascript
const { handleConfigCommand } = require('../config');

// Show full or section
await handleConfigCommand('show', { section: 'component_name' });

// Get value
await handleConfigCommand('get', { _: ['component.key'] });

// Set value
await handleConfigCommand('set', { _: ['component.key', 'value'] });

// Validate
await handleConfigCommand('validate', {});

// Hooks report (git-specific)
await handleConfigCommand('hooks', {});

// Edit
await handleConfigCommand('edit', {});
```

## Schema-Driven Config (Future)

### Vision

```yaml
# .supernal/schemas/git_hooks.schema.yaml
type: object
properties:
  enabled:
    type: boolean
    default: true
  pre_commit:
    type: object
    properties:
      checks:
        type: object
        patternProperties:
          '^[a-z_]+$':
            type: object
            required: [enabled]
```

### Usage

```javascript
// Component declares its schema
const schema = require('../../schemas/git_hooks.schema.yaml');

// Config module validates against schema
await handleConfigCommand('validate', {
  section: 'git_hooks',
  schema,
});
```

## Component Config Checklist

When adding config support to a component:

- [ ] Define config structure in component documentation
- [ ] Use `handleConfigCommand()` for all operations
- [ ] Add component-specific commands only for convenience (e.g., `sc git-hooks config` → `sc config show --section git_hooks`)
- [ ] Document environment overrides (e.g., `SC_SKIP_*` variables)
- [ ] Add to `sc init` template generation
- [ ] Create schema (future)

## Examples by Component

### Git Hooks

```bash
sc git-hooks config           # → sc config show --section git_hooks
sc config get git_hooks.enabled
sc config set git_hooks.pre_commit.checks.eslint.enabled false
```

### Features (future)

```bash
sc feature config             # → sc config show --section features
sc config get features.validation.strict_mode
sc config set features.domains "[admin,dashboard,api]"
```

### Requirements (future)

```bash
sc req config                 # → sc config show --section requirements
sc config get requirements.templates_dir
sc config set requirements.auto_generate_ids true
```

## Migration Guide: From Custom to Reusable

### Before (Anti-Pattern)

```javascript
// Each component implements its own config logic
async showConfig() {
  const yaml = require('yaml');
  const fs = require('fs');
  const configPath = path.join(process.cwd(), 'supernal.yaml');
  const content = fs.readFileSync(configPath, 'utf8');
  const config = yaml.parse(content);
  console.log(JSON.stringify(config.my_component, null, 2));
}
```

**Problems**:

- Duplicated YAML parsing
- No error handling
- No backup on writes
- No validation
- Multiple config loads (slow)

### After (Pattern)

```javascript
// Delegate to config module
async showConfig(options = {}) {
  const { handleConfigCommand } = require('../config');
  await handleConfigCommand('show', {
    section: 'my_component',
    ...options
  });
}
```

**Benefits**:

- Single config load
- Consistent error handling
- Automatic backups
- Built-in validation
- Fast (<300ms)

## Advanced: Multi-YAML Support (Future)

### Concept

```javascript
// Allow components to use custom config files with schema
await handleConfigCommand('show', {
  file: '.supernal/components/git-hooks.yaml',
  schema: gitHooksSchema,
  section: 'advanced_checks',
});
```

### Use Cases

- Component-specific config files
- Environment-specific configs (dev/prod)
- Template configs
- Migration configs

## Performance Considerations

### Config Caching

```javascript
// Config module should cache loaded configs
const configCache = new Map();

function loadConfig(file = 'supernal.yaml') {
  if (configCache.has(file)) {
    return configCache.get(file);
  }

  const config = yaml.parse(fs.readFileSync(file, 'utf8'));
  configCache.set(file, config);
  return config;
}
```

### Lazy Loading

Only load sections when needed:

```javascript
await handleConfigCommand('get', {
  _: ['git_hooks.enabled'], // Only loads git_hooks section
});
```

## Related Documentation

- [Configuration Management Guide](../../../../docs/guides/configuration-management.md)
- [SOP-T.01: Using sc CLI](../../../../docs/workflow/sops/tools/SOP-T.01-using-sc-cli.md)
- [Git Workflow SOP](../../../../docs/workflow/sops/general/SOP-0.1.12-git-workflow.md)

## Questions?

This pattern ensures consistency across all SC components. When adding config to a new component, ask:

1. Can I delegate to `handleConfigCommand()`? → **YES** (almost always)
2. Do I need custom config logic? → **NO** (unless truly component-specific formatting)
3. Should I create a new YAML file? → **NO** (use sections in supernal.yaml unless config is >500 lines)
