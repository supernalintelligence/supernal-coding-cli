# Chat Sessions

Cursor chat exports related to this feature's development.

## Purpose

This directory preserves AI-assisted development conversations for:

- **Context preservation**: Future developers can see the reasoning
- **Knowledge capture**: Important decisions and discoveries
- **Debugging history**: What was tried, what worked, what didn't
- **Learning**: Patterns and approaches used

## Using cursor-chat-export

Install globally:

```bash
npm install -g cursor-chat-export
```

Export a chat:

```bash
cursor-chat-export
```

Then move the exported markdown file here and name it appropriately:

```bash
mv ~/Downloads/cursor-chat-*.md chats/YYYY-MM-DD-topic-description.md
```

## Naming Convention

```
YYYY-MM-DD-HH-MM-topic-description.md
```

**Examples**:

- `2024-11-25-14-30-initial-feature-design.md`
- `2024-11-26-09-15-validation-system-implementation.md`
- `2024-11-26-16-45-bug-fix-edge-case-handling.md`

## Best Practices

- **Export after significant work**: Don't export every chat, just meaningful ones
- **Name descriptively**: Use kebab-case, include the topic
- **Keep organized**: One chat per file
- **Link from docs**: Reference chats in planning docs when relevant

**Example link in a planning doc**:

```markdown
See discussion in [initial design chat](../chats/2024-11-25-initial-feature-design.md)
for rationale behind the validation approach.
```

## What to Export

✅ **DO export**:

- Feature design sessions
- Complex problem-solving discussions
- Architecture decision conversations
- Debugging sessions that uncovered important insights
- Implementation planning with significant AI collaboration

❌ **DON'T export**:

- Trivial formatting fixes
- Simple typo corrections
- Test runs with no discussion
- Repetitive/redundant conversations

## See Also

- [cursor-chat-export on GitHub](https://github.com/somogyijanos/cursor-chat-export)
- Feature requirement: [REQ-004: Chat Export](../../../../docs/features/dashboard-platform/feature-by-phase-view/requirements/req-004-chat-export.md)
