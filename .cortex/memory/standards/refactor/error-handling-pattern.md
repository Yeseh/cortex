---
created_at: 2026-02-14T13:49:18.218Z
updated_at: 2026-02-14T13:49:18.218Z
tags:
  - refactor
  - pattern
  - error-handling
  - result-type
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/memory/result.ts
---
# Error Handling Pattern

Each module defines its own error type, error codes, and error factory.

## Module Error Type Structure

```typescript
// result.ts in each module

// 1. Module-specific Result alias
export type ModuleResult<T> = Result<T, ModuleError>;

// 2. Error type with standard fields
export type ModuleError = {
    code: ModuleErrorCode;
    message: string;
    field?: string;      // For validation errors
    line?: number;       // For parse errors
    path?: string;       // For path-related errors
    cause?: unknown;     // For wrapping underlying errors
};

// 3. Discriminated union of error codes
export type ModuleErrorCode =
    | 'INVALID_PATH'
    | 'NOT_FOUND'
    | 'STORAGE_ERROR'
    | 'INVALID_INPUT';

// 4. Error factory function returning Result<never, Error>
export const moduleError = (
    code: ModuleErrorCode,
    message: string,
    extras?: Partial<ModuleError>,
): Result<never, ModuleError> => err({
    code,
    message,
    ...extras,
});
```

## Usage in Operations

```typescript
import { memoryError, type MemoryResult } from '../result.ts';

const getMemory = async (...): Promise<MemoryResult<Memory>> => {
    const pathResult = MemoryPath.fromPath(path);
    if (!pathResult.ok()) {
        return memoryError('INVALID_PATH', pathResult.error.message, {
            path,
            cause: pathResult.error,
        });
    }
    // ...
};
```

## Key Rules

1. **Return typed errors** - Never throw in business logic
2. **Include cause** - When wrapping errors, include original in `cause`
3. **Include context** - Add `path`, `field`, etc. for debugging
4. **Human-readable messages** - Messages should be actionable
5. **Module owns its error types** - MemoryError, CategoryError, etc.