---
created_at: 2026-02-14T21:36:08.951Z
updated_at: 2026-02-14T21:36:08.951Z
tags:
  - code-smell
  - category
  - error-handling
  - low-priority
source: mcp
citations:
  - packages/core/src/category/category-path.ts
  - packages/core/src/category/types.ts
---
# CategoryPath Uses MemoryError Instead of CategoryError

## Current State

`CategoryPath` class in `packages/core/src/category/category-path.ts` currently returns `Result<CategoryPath, MemoryError>` and imports error helpers from the memory module:

```typescript
import { memoryError, type MemoryError } from '@/memory/result';

static fromString(path: string): Result<CategoryPath, MemoryError> {
    // ...
    return memoryError('INVALID_PATH', 'Memory slug path must include at least one segment...');
}
```

## Why This is a Code Smell

1. **Inappropriate coupling**: Category module depends on Memory module for error types
2. **Wrong error domain**: Category validation errors are labeled as "memory" errors
3. **Already have CategoryError**: The `types.ts` file already defines proper `CategoryError` and `CategoryErrorCode` types

## What Should Happen

CategoryPath should:
- Import from `@/category/types` instead of `@/memory/result`
- Return `Result<CategoryPath, CategoryError>`
- Use category-specific error codes from `CategoryErrorCode`

## Why Not Urgent

- Category module already has complete error infrastructure in `types.ts`
- The coupling doesn't cause functional issues (both error types are compatible)
- Low impact on runtime behavior
- More of a code quality / architectural consistency issue

## Solution When Needed

1. Create `categoryError()` helper in `category/types.ts` (matching pattern from memory module)
2. Update `CategoryPath.fromString()` and `fromSegments()` to use `CategoryError`
3. Update all places that handle CategoryPath results to expect CategoryError