---
created_at: 2026-01-27T20:21:08.036Z
updated_at: 2026-01-27T20:21:08.036Z
tags: [exports, modules, barrel]
source: mcp
---
The `index.ts` barrel file should:

1. Re-export types explicitly with `export type {}`
2. Re-export values with `export {}`
3. Rename port interfaces with `as` for clarity (e.g., `CategoryStorage as CategoryStoragePort`)
4. Export constants directly
5. Group exports logically (types first, then functions, then constants)

**Example:**
```typescript
export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStorage as CategoryStoragePort,  // Renamed for clarity
} from './types.ts';

export { MAX_DESCRIPTION_LENGTH } from './types.ts';

export {
    isRootCategory,
    getParentPath,
    getAncestorPaths,
    createCategory,
    setDescription,
    deleteCategory,
} from './operations.ts';
```