---
created_at: 2026-01-29T20:11:39.637Z
updated_at: 2026-01-29T20:11:39.637Z
tags:
  - cli
  - commander
  - breaking-change
  - architecture
source: mcp
---
# CLI Commander.js Refactor Decision

## Context
The CLI was refactored from flat commands to nested Commander.js structure in PR #5.

## Decision
- **BREAKING**: Flat commands (`cortex add`) become nested (`cortex memory add`)
- Removed `--global-store` flag; use `--store` for named stores from registry
- Adopted Commander.js with `@commander-js/extra-typings` for type safety

## New Command Structure
```
cortex init                        # Global config setup
cortex memory add|show|update|remove|move|list  # Memory operations
cortex store list|add|remove|init|prune|reindex # Store management
```

## Rationale
- Eliminates ~500 lines of custom argument parsing
- Commander generates help automatically
- Better UX with consistent short flags
- Type-safe command definitions