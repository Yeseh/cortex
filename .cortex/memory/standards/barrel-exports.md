---
created_at: 2026-01-27T20:21:08.036Z
updated_at: 2026-02-05T19:20:25.537Z
tags:
  - exports
  - modules
  - barrel
  - patterns
source: mcp
---
# Barrel Export Pattern

Each module has an `index.ts` that selectively re-exports public API.

## Module Structure
```
memory/
├── index.ts      # Selective re-exports (public API)
├── types.ts      # Type definitions
├── operations.ts # Business logic
├── validation.ts # Input validation
└── expiration.ts # Utilities
```

## Export Guidelines

1. Re-export types explicitly with `export type {}`
2. Re-export values with `export {}`
3. Rename port interfaces with `as` for clarity (e.g., `CategoryStorage as CategoryStoragePort`)
4. Export constants directly
5. Group exports logically (types first, then functions, then constants)

## Example (memory/index.ts)
```typescript
export type {
    MemoryMetadata,
    Memory,
    MemoryError,
    CategoryStorage as CategoryStoragePort,  // Renamed for clarity
} from './types.ts';

export { MAX_DESCRIPTION_LENGTH } from './types.ts';

export { validateCategoryPath, validateMemorySlugPath } from './validation.ts';
export { isExpired, isExpiredNow } from './expiration.ts';
export { createMemory, getMemory, updateMemory } from './operations.ts';
```

## Subpath Exports (package.json)
```json
{
    "exports": {
        ".": "./src/index.ts",
        "./memory": "./src/memory/index.ts",
        "./category": "./src/category/index.ts"
    }
}
```

## Benefits
- Clear public API surface
- Implementation details hidden
- Import paths are clean: `import { Memory } from '@yeseh/cortex-core/memory'`