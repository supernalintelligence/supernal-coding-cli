# Planning Documents

This directory contains implementation plans, task breakdowns, and integration strategies.

## What Goes Here

- **Implementation Plans**: Step-by-step implementation guides
- **Task Breakdowns**: Detailed work breakdown structures
- **Technical Specifications**: Detailed technical requirements
- **Integration Strategies**: How this feature integrates with existing systems
- **Migration Plans**: If applicable, how to migrate from old to new

## Using Documentation Processor

For large implementations, use the documentation processor pattern:

````markdown
**File**: `path/to/file.ts`

```typescript
// Your code here
```
````

````

Then run:

```bash
sc docs process planning/my-plan.md
````

This will:

- ✅ Create files automatically
- ✅ Mark code blocks as IMPLEMENTED
- ✅ Detect conflicts

See [documentation-processor rule](mdc:.cursor/rules/documentation-processor.mdc) for details.

## Best Practices

- **Be Specific**: Include file paths, function names, exact changes
- **Include Context**: Explain why, not just what
- **Track Decisions**: Link to ADRs when architectural decisions are made
- **Update as Needed**: Plans evolve - keep them current
- **Archive When Done**: Move old plans to `archive/` when superseded
