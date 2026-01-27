---
created_at: 2026-01-27T20:20:37.480Z
updated_at: 2026-01-27T20:20:37.480Z
tags: [errors, result-type, typescript, error-handling]
source: mcp
---
All fallible operations return `Result<T, E>` types instead of throwing exceptions:

```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

**Helper functions in `core/result.ts`:**
- `ok<T>(value: T): Result<T, never>` - Creates success result
- `err<E>(error: E): Result<never, E>` - Creates error result

**Error types are discriminated unions with machine-readable codes:**

```typescript
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH';

export interface CategoryError {
    code: CategoryErrorCode;  // Machine-readable for programmatic handling
    message: string;          // Human-readable
    path?: string;            // Context
    cause?: unknown;          // Underlying error for debugging
}
```