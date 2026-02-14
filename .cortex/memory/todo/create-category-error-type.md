---
created_at: 2026-02-14T13:53:54.162Z
updated_at: 2026-02-14T13:53:54.162Z
tags:
  - todo
  - refactor
  - category
  - error-handling
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/category/category-path.ts
  - packages/core/src/category/types.ts
---
# TODO: Create CategoryError Type

The category module should have its own error type instead of borrowing from memory.

## Current State

`CategoryPath` returns `Result<CategoryPath, MemoryError>` and uses `memoryError` helper from memory module. This creates an inappropriate coupling.

## Required Changes

### 1. Create `packages/core/src/category/result.ts`

```typescript
import { err, type Result } from '@/result';

export type CategoryResult<T> = Result<T, CategoryError>;

export type CategoryError = {
    code: CategoryErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
};

export type CategoryErrorCode =
    | 'INVALID_PATH'
    | 'ROOT_CATEGORY_REJECTED'
    | 'CATEGORY_NOT_FOUND'
    | 'STORAGE_ERROR';

export const categoryError = (
    code: CategoryErrorCode,
    message: string,
    extras?: Partial<CategoryError>,
): Result<never, CategoryError> => err({
    code,
    message,
    ...extras,
});
```

### 2. Update `category-path.ts`

- Import from `./result.ts` instead of memory module
- Return `CategoryResult<CategoryPath>` instead of `Result<CategoryPath, MemoryError>`
- Use `categoryError()` instead of `memoryError()`

### 3. Update `category/operations.ts`

- Use new `CategoryResult` type
- Use `categoryError()` factory

### 4. Update barrel exports

- Export error types from `category/index.ts`