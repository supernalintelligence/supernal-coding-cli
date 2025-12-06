# Requirements Parser - Shared Library

## Overview

Centralized requirement parsing logic shared across dashboard applications to eliminate code duplication.

## Location

```
supernal-code-package/lib/requirements/
├── parser.js       # Core parsing logic
└── types.js        # Type definitions (JSDoc)
```

## Usage

### From Dashboard-v2 (TypeScript)

```typescript
import {
  parseRequirement,
  loadRequirements,
  generatePhaseStats,
  getRepoConfig,
} from '../lib/utils/requirementParser';

// Parse single requirement
const req = parseRequirement('/path/to/req-001-feature.md');

// Load all requirements
const reqs = await loadRequirements('/path/to/docs', '/path/to/repo');

// Generate statistics
const stats = generatePhaseStats(reqs);

// Get repo configuration
const config = getRepoConfig('supernal-coding');
```

### From Dashboard-runtime (TypeScript)

```typescript
import {
  parseRequirement,
  loadRequirements,
  generatePhaseStats,
  getRepoConfig,
} from '../lib/utils/requirementParser';

// Same API as dashboard-v2
const req = parseRequirement('/path/to/req-001-feature.md');
```

### From Node.js (CommonJS)

```javascript
const {
  parseRequirement,
  loadRequirements,
  generatePhaseStats,
  getRepoConfig,
} = require('supernal-code-package/lib/requirements/parser');

// Parse requirement
const req = parseRequirement('/path/to/req-001-feature.md');
```

## Architecture

### Type Determination Priority

1. **Folder-based** (Primary) - `/requirements/stories/` → `story`
2. **Content-based** (Fallback) - Contains "user story" → `story`
3. **Phase-based** (Last resort) - `phase: discovery` → `problem`

### Supported Requirement Types

- `evidence` - Evidence documentation
- `problem` - Problem statements
- `story` - User stories
- `functional-requirement` - Functional requirements
- `technical-requirement` - Technical requirements
- `component` - Component specifications
- `architecture` - Architecture decisions
- `test` - Test specifications
- `monitoring` - Monitoring requirements
- `verification` - Verification criteria
- `compliance` - Compliance requirements
- `kanban` - Workflow items

### Workflow Integration

The parser integrates with WorkflowLoader to respect project-specific:

- Directory patterns
- File naming patterns
- Exclusion rules

Fallback behavior when workflow config unavailable:

- Scans default directories
- Uses standard requirement prefixes (`req-`, `prob-`, `story-`, etc.)
- Excludes common non-requirement files

## API Reference

### `parseRequirement(filePath: string): Requirement | null`

Parses a single requirement markdown file.

**Parameters:**

- `filePath` - Absolute or relative path to requirement file

**Returns:** Parsed `Requirement` object or `null` on error

**Extracts:**

- YAML frontmatter (priority, phase, status, dependencies, epic, etc.)
- Title from heading or filename
- Category from folder path
- Type via intelligent type determination

### `loadRequirements(requirementsDir: string, repoPath?: string): Promise<Requirement[]>`

Loads all requirements from a directory tree.

**Parameters:**

- `requirementsDir` - Base requirements directory
- `repoPath` - Optional repository path for workflow config

**Returns:** Promise of array of `Requirement` objects

**Features:**

- Recursive directory traversal
- De-duplication by absolute path
- Workflow-driven configuration
- Automatic exclusion of templates, archives, drafts

### `generatePhaseStats(requirements: Requirement[]): PhasesData`

Generates statistics grouped by requirement type.

**Parameters:**

- `requirements` - Array of requirements

**Returns:** `PhasesData` with groups and stats

**Provides:**

- Total, completed, in-progress, pending counts
- Progress percentages
- Requirements grouped by type

### `getRepoConfig(repoId: string): RepoConfig`

Gets repository configuration.

**Parameters:**

- `repoId` - Repository identifier

**Returns:** Configuration object with paths

**Features:**

- Production/Vercel detection
- `supernal.yaml` configuration reading
- Renaissance structure support

### `determineRequirementType(...): RequirementType`

Determines requirement type using multi-level heuristics.

## Migration from Duplicated Code

Both dashboards now use thin TypeScript wrappers that:

1. Import the shared CommonJS module
2. Re-export with TypeScript types
3. Maintain backward compatibility

**Before:**

- dashboard-v2: 583 lines of TypeScript
- dashboard-runtime: 318 lines of TypeScript
- **Total: 901 lines (duplicated logic)**

**After:**

- Shared parser: 600 lines of JavaScript (single source of truth)
- dashboard-v2 wrapper: ~75 lines (type-safe re-exports)
- dashboard-runtime wrapper: ~55 lines (type-safe re-exports)
- **Total: 730 lines (30% reduction, 0% duplication)**

## Benefits

1. **DRY Compliance** - Single source of truth for parsing logic
2. **Consistent Behavior** - Both dashboards use identical logic
3. **Easier Maintenance** - Bug fixes and features in one place
4. **Type Safety** - JSDoc types for JavaScript, TypeScript wrappers for dashboards
5. **Backward Compatible** - Existing code continues to work unchanged

## Testing

Test the shared parser:

```bash
# From monorepo root
cd supernal-code-package
npm test lib/requirements/parser.test.js
```

Test dashboards:

```bash
# Dashboard-v2
cd apps/dashboard-v2
npm test

# Dashboard-runtime
cd supernal-code-package/dashboard-runtime
npm test
```

## Future Enhancements

- [ ] Add unit tests for shared parser
- [ ] Extract types to TypeScript declarations (`.d.ts`)
- [ ] Support additional requirement formats
- [ ] Plugin system for custom type determination
