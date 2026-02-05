---
created_at: 2026-01-27T20:20:37.480Z
updated_at: 2026-02-05T19:21:10.821Z
tags:
  - errors
  - result-type
  - typescript
  - error-handling
  - patterns
source: mcp
---
# Result Type Pattern (Railway-Oriented Programming)

All fallible operations return `Result<T, E>` types instead of throwing exceptions.

## Type Definition
```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

## Helper Functions (core/result.ts)
```typescript
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

## Usage Pattern
```typescript
const result = await someOperation();
if (!result.ok) {
    // Handle error - result.error is typed
    return err(result.error);
}
// Continue with result.value - properly typed
```

## Error Types (Discriminated Unions)
Error types use machine-readable codes:

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

## Benefits
- Explicit error handling at call sites
- No hidden exceptions
- Type-safe error discrimination
- Composable via chaining
- Maps cleanly to HTTP/MCP error codes at boundaries