---
created_at: 2026-02-14T13:49:04.493Z
updated_at: 2026-02-14T13:49:04.493Z
tags:
  - refactor
  - pattern
  - module-structure
  - operations
  - testing
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/memory/operations/index.ts
  - packages/core/src/memory/operations/create.ts
  - packages/core/src/memory/operations/helpers.ts
  - packages/core/src/memory/operations/test-helpers.spec.ts
---
# Module Structure Pattern: Operations

Split large operation files into dedicated modules for each operation.

## Directory Structure

```
src/{module}/
├── index.ts           # Barrel exports
├── {domain}.ts        # Domain class (Memory, CategoryPath, etc.)
├── {domain-path}.ts   # Path class (MemoryPath, etc.)
├── result.ts          # Module-specific Result type and error factory
└── operations/
    ├── index.ts       # Barrel exports for operations
    ├── create.ts      # Create operation + CreateInput type
    ├── create.spec.ts # Tests for create
    ├── get.ts         # Get operation + GetOptions type
    ├── get.spec.ts    # Tests for get
    ├── update.ts      # Update operation + UpdateInput type
    ├── update.spec.ts # Tests for update
    ├── helpers.ts     # Shared internal helpers (not exported)
    └── test-helpers.spec.ts  # Mock factories for tests
```

## Naming Conventions

- **Operations**: verb-based - `create.ts`, `get.ts`, `update.ts`, `remove.ts`, `move.ts`, `list.ts`
- **Input types**: `Create{Domain}Input`, `Update{Domain}Input`, `Get{Domain}Options`
- **Result types**: `{Domain}Result<T>` = `Result<T, {Domain}Error>`

## Barrel Export Pattern

```typescript
// operations/index.ts
export { createMemory } from './create.ts';
export type { CreateMemoryInput } from './create.ts';
export { getMemory } from './get.ts';
export type { GetMemoryOptions } from './get.ts';
// ... etc
```

## Helpers Pattern

Internal helpers in `helpers.ts`:
- `readCategoryIndex()` - common index reading logic
- `discoverRootCategories()` - category discovery
- `collectMemoriesFromCategory()` - recursive collection
- `getCategoryFromSlugPath()` - path manipulation

## Test Helpers Pattern

`test-helpers.spec.ts` provides:
- `createMockStorage()` - factory with partial overrides
- `ok()`, `err()` - re-exported for convenience
- Sample fixtures (`sampleMemoryContent`, etc.)
- `buildIndex()` - index builder helper