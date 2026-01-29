---
created_at: 2026-01-28T18:54:43.706Z
updated_at: 2026-01-29T16:44:51.461Z
tags: [tests, status, store-init]
source: mcp
---
# Test Suite Status (2026-01-29 - Updated)

## Current Status
Core tests pass. There are 23 pre-existing test failures in `src/core/storage/filesystem/` related to memory parsing changes.

## Recent Work
- **Store Init Tests** (Added 2026-01-29): 29 tests for the new `store init` project support feature, all passing
- **Output Tests**: 46 tests pass

## Known Pre-existing Issues
The following tests fail in the base worktree (pre-existing, not introduced by store init feature):
- `src/core/storage/filesystem/memories.spec.ts` - Memory parsing tests (8 failures)
- `src/core/storage/filesystem/index.spec.ts` - Filesystem adapter tests (5 failures)

These appear related to changes in the memory file format/parsing that haven't been fully propagated.

## Test Commands
```bash
# Run store tests (all pass)
bun test src/core/store src/cli/commands/store.test.ts

# Run output tests (all pass)  
bun test src/cli/output.spec.ts
```