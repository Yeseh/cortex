# Study Session: Category Module Patterns

**Date:** 2026-01-27  
**Module Analyzed:** `src/core/category/`  
**Purpose:** Document architectural and coding patterns for memory import

---

## Memory Entries to Create

### 1. Ports and Adapters Architecture (Hexagonal Architecture)

**Category:** `projects/cortex/standards/architecture`  
**Tags:** architecture, patterns, ports-and-adapters

Business logic modules in Cortex follow the ports and adapters (hexagonal) architecture pattern:

- **operations.ts** - Pure business logic functions; each function takes a storage port as its first parameter
- **types.ts** - Defines the port interface (contract), error types with discriminated unions, and result types
- **index.ts** - Barrel file that exports the public API; re-exports are explicit and selective

This pattern allows:

- Testing business logic with mock storage implementations
- Swapping storage backends without changing business logic
- Clear separation between "what" (business rules) and "how" (storage)

**Example structure:**

```
src/core/{module}/
├── index.ts           # Public API barrel exports
├── types.ts           # Port interface, error codes, result types
├── operations.ts      # Pure business logic functions
└── operations.spec.ts # Unit tests with mock storage
```

---

### 2. Result Types for Error Handling

**Category:** `projects/cortex/standards/error-handling`  
**Tags:** errors, result-type, typescript

All fallible operations return `Result<T, E>` types instead of throwing exceptions:

```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Helper functions in `core/result.ts`:

- `ok<T>(value: T): Result<T, never>` - Creates success result
- `err<E>(error: E): Result<never, E>` - Creates error result

Error types are discriminated unions with machine-readable codes:

```typescript
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH';

export interface CategoryError {
    code: CategoryErrorCode; // Machine-readable for programmatic handling
    message: string; // Human-readable
    path?: string; // Context
    cause?: unknown; // Underlying error for debugging
}
```

---

### 3. Self-Documenting Error Messages

**Category:** `projects/cortex/standards/error-handling`  
**Tags:** errors, ux, agents, self-documenting

Error messages MUST include actionable guidance for the caller (human or AI agent) on how to fix or mitigate the issue. This makes tools self-documenting for agents using them.

**Pattern:**

```typescript
return err({
    code: 'CATEGORY_NOT_FOUND',
    message: `Category not found: ${path}. Create it first with createCategory('${path}') or check the path is correct.`,
    path,
});

return err({
    code: 'ROOT_CATEGORY_REJECTED',
    message:
        'Cannot set description on root category. Use a subcategory path like "project/my-category" instead.',
    path,
});

return err({
    code: 'DESCRIPTION_TOO_LONG',
    message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters. Current length: ${trimmed.length}. Shorten the description or split into multiple memories.`,
    path,
});
```

**Principles:**

- Include the failing value in context (e.g., the path that wasn't found)
- Suggest the correct API call to fix the issue
- Provide alternatives when applicable
- Be specific about constraints (e.g., exact max length, not just "too long")

---

### 4. Documentation Standards

**Category:** `projects/cortex/standards/documentation`  
**Tags:** jsdoc, comments, documentation

Every exported function MUST have comprehensive JSDoc comments including:

1. **Module-level `@module` tag** at file top
2. **Function description** explaining purpose and constraints
3. **`@param` tags** for all parameters
4. **`@returns` description** with error conditions
5. **`@example` blocks** showing typical usage
6. **Edge case documentation** in prose explaining boundary conditions

Example from `operations.ts`:

````typescript
/**
 * Creates a category and its parent hierarchy, excluding root categories.
 *
 * This function implements idempotent category creation:
 * - If the category exists, returns success with `created: false`
 * - If the category doesn't exist, creates it and any missing ancestors
 * - Root categories are assumed to exist (not created automatically)
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to create (e.g., "project/cortex/api")
 * @returns Result with creation details or error
 *
 * @example
 * ```typescript
 * const result = await createCategory(storage, 'project/cortex/api');
 * if (result.ok) {
 *   console.log(result.value.created ? 'Created' : 'Already existed');
 * }
 * ```
 */
````

---

### 4. Operation Result Types

**Category:** `projects/cortex/standards/operations`  
**Tags:** operations, result-types, idempotent

Each operation should have its own result type documenting what it returns:

```typescript
export interface CreateCategoryResult {
    path: string; // The normalized path
    created: boolean; // True if newly created, false if existed
}

export interface SetDescriptionResult {
    path: string;
    description: string | null; // null if cleared
}

export interface DeleteCategoryResult {
    path: string;
    deleted: boolean;
}
```

**Idempotency Pattern:**

- Create operations: Return success with `created: false` if already exists
- Delete operations: NOT idempotent - return error if doesn't exist
- Update operations: Idempotent - same input produces same output

---

### 5. Testing Patterns

**Category:** `projects/cortex/standards/testing`  
**Tags:** testing, mocks, bun-test

Test files are colocated with source: `{filename}.spec.ts`

**Mock Factory Pattern:**
Create a factory function returning a mock implementation of the port interface:

```typescript
const createMockStorage = (overrides: Partial<CategoryStorage> = {}): CategoryStorage => ({
    categoryExists: mock(async () => ok(false)),
    readCategoryIndex: mock(async () => ok(null)),
    writeCategoryIndex: mock(async () => ok(undefined)),
    ensureCategoryDirectory: mock(async () => ok(undefined)),
    deleteCategoryDirectory: mock(async () => ok(undefined)),
    updateSubcategoryDescription: mock(async () => ok(undefined)),
    removeSubcategoryEntry: mock(async () => ok(undefined)),
    ...overrides,
});
```

**Test Organization:**

- Use `describe` blocks per function
- Each `it` block tests one specific behavior
- Name tests as "should {expected behavior}"
- Test both success and error paths
- Test edge cases (empty strings, boundary values, etc.)

**Type Assertions:**
Use `as` assertions when Bun test type inference needs help:

```typescript
expect(capturedDesc as string | null).toBe('trimmed');
```

---

### 6. Function Signature Pattern

**Category:** `projects/cortex/standards/functions`  
**Tags:** functions, signatures, async

Business logic functions follow this signature pattern:

```typescript
export const operationName = async (
    storage: StoragePort, // Port always first parameter
    ...params: T[] // Operation-specific parameters
): Promise<Result<OperationResult, DomainError>> => {
    // Implementation
};
```

Pure helper functions (no I/O) omit the storage parameter and are synchronous:

```typescript
export const isRootCategory = (path: string): boolean => {
    // Pure logic
};
```

---

### 7. Barrel Export Pattern

**Category:** `projects/cortex/standards/exports`  
**Tags:** exports, modules, barrel

The `index.ts` barrel file should:

1. Re-export types explicitly with `export type {}`
2. Re-export values with `export {}`
3. Rename port interfaces with `as` for clarity (e.g., `CategoryStorage as CategoryStoragePort`)
4. Export constants directly
5. Group exports logically (types first, then functions, then constants)

```typescript
export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStorage as CategoryStoragePort, // Renamed for clarity
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

---

## Summary Checklist

When creating a new business logic module:

- [ ] Create `types.ts` with port interface, error codes (discriminated union), and result types
- [ ] Create `operations.ts` with pure functions that take port as first param
- [ ] Add comprehensive JSDoc with `@module`, `@example`, edge case docs
- [ ] All fallible operations return `Result<T, E>`, never throw
- [ ] **Error messages include actionable guidance** - suggest how to fix/mitigate the issue
- [ ] Create `operations.spec.ts` with mock factory and describe blocks
- [ ] Create `index.ts` barrel with explicit type/value exports
- [ ] Follow idempotency patterns (create returns `created: false`, delete errors on missing)
- [ ] Document MAX\_\* constants with rationale in JSDoc
