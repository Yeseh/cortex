---
created_at: 2026-01-31T15:26:04.418Z
updated_at: 2026-01-31T15:26:04.418Z
tags:
  - decision
  - testing
  - monorepo
  - operations
source: mcp
---
# Decision: Split operations.spec.ts Test File

## Context
During the monorepo conversion, the `packages/core/src/memory/operations.spec.ts` file needed extensive updates:
- All operation functions now require a `MemorySerializer` parameter (dependency injection)
- Return type changed from `MemoryFileContents` (with `frontmatter`) to `Memory` (with `metadata`)
- The test file is very large (1000+ lines) with many test cases

## Decision
Split the operations test file into smaller, focused test files:
- `operations.create.spec.ts` - createMemory tests
- `operations.get.spec.ts` - getMemory tests  
- `operations.update.spec.ts` - updateMemory tests
- `operations.move.spec.ts` - moveMemory tests
- `operations.remove.spec.ts` - removeMemory tests
- `operations.list.spec.ts` - listMemories tests
- `operations.prune.spec.ts` - pruneExpiredMemories tests

## Rationale
- Easier to maintain and update individual test sections
- Faster test runs when working on specific operations
- Clearer organization following single-responsibility principle
- Reduces merge conflicts when multiple people work on tests

## Status
Pending implementation during monorepo conversion