---
created_at: 2026-02-14T13:48:34.476Z
updated_at: 2026-02-14T13:48:34.476Z
tags:
  - refactor
  - pattern
  - result-type
  - error-handling
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/result.ts
---
# Result Type Usage Pattern

The Result type is now implemented as classes (`Ok<T>` and `Err<E>`) instead of plain objects.

## Type Definition

```typescript
export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
    readonly value: T;
    readonly error: undefined = undefined;
    ok(): this is Ok<T> { return true; }
    err(): this is Err<never> { return false; }
    unwrap(): T { return this.value; }
}

export class Err<E> {
    readonly value: undefined = undefined;
    readonly error: E;
    ok(): this is Ok<never> { return false; }
    err(): this is Err<E> { return true; }
    unwrap(): never { throw new Error(...); }
}
```

## Usage Rules

1. **Always use `result.ok()` method** for type narrowing (not `result.ok` property)
2. **After `result.ok()` check**, TypeScript narrows to `Ok<T>` or `Err<E>`
3. **Use `ok()` and `err()` factory functions** to create results

## Correct Pattern

```typescript
const result = someOperation();
if (!result.ok()) {
    return memoryError('ERROR_CODE', result.error.message, {
        cause: result.error,
    });
}
// result is now Ok<T>, access result.value safely
const value = result.value;
```

## Anti-Patterns

```typescript
// WRONG: Using old object literal syntax
return { ok: true, value };   // ❌
return { ok: false, error };  // ❌

// WRONG: Checking property instead of method
if (result.ok) { ... }  // ❌

// CORRECT: Use factory functions
return ok(value);    // ✅
return err(error);   // ✅

// CORRECT: Use method for type narrowing
if (result.ok()) { ... }  // ✅
```