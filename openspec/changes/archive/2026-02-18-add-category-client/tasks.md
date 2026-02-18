# Tasks: Add CategoryClient

## 1. Create CategoryClient Class

- [x] 1.1 Create `packages/core/src/cortex/category-client.ts`
- [x] 1.2 Define `CategoryClient` class with `readonly rawPath: string`
- [x] 1.3 Add `parsePath(): Result<CategoryPath, PathError>` method
- [x] 1.4 Add path normalization helper (leading slash, no trailing, collapse multiple)
- [x] 1.5 Add JSDoc documentation with examples

## 2. Navigation Methods

- [x] 2.1 Implement `getCategory(path: string): CategoryClient` - relative path navigation
- [x] 2.2 Implement `getMemory(slug: string): Result<never, CategoryError>` - returns NOT_IMPLEMENTED (stub until MemoryClient exists)
- [x] 2.3 Implement `parent(): CategoryClient | null` - returns null when `rawPath === '/'`

## 3. Lifecycle Methods

- [x] 3.1 Implement `create(): Promise<Result<Category, CategoryError>>` - wraps `createCategory`
- [x] 3.2 Implement `delete(): Promise<Result<void, CategoryError>>` - wraps `deleteCategory` (always recursive)
- [x] 3.3 Implement `exists(): Promise<Result<boolean, CategoryError>>` - checks category existence

## 4. Metadata and Listing Methods

- [x] 4.1 Implement `setDescription(description: string | null): Promise<Result<void, CategoryError>>`
- [x] 4.2 Implement `listMemories(options?): Promise<Result<MemoryInfo[], CategoryError>>`
- [x] 4.3 Implement `listSubcategories(): Promise<Result<CategoryInfo[], CategoryError>>`

## 5. Store-wide Operations

- [x] 5.1 Implement `reindex(): Promise<Result<ReindexResult, CategoryError>>` - operates on entire store (not subtree-scoped)
- [x] 5.2 Implement `prune(options?): Promise<Result<PruneResult, CategoryError>>` - operates on entire store (not subtree-scoped)

## 6. Update StoreClient

- [x] 6.1 Update `StoreClient.rootCategory()` to return real `CategoryClient` with `rawPath: '/'`
- [x] 6.2 Pass `ScopedStorageAdapter` to `CategoryClient` constructor

> **Note:** Completed as part of `add-store-client` proposal. StoreClient.rootCategory() returns `CategoryClient.create('/', this.adapter)`.

## 7. Write Tests

- [x] 7.1 Create `packages/core/src/cortex/category-client.spec.ts`
- [x] 7.2 Test path normalization (leading slash, trailing slash, multiple slashes)
- [x] 7.3 Test `getCategory()` path concatenation
- [x] 7.4 Test `parent()` navigation including null at root
- [x] 7.5 Test lazy validation - invalid path errors on first async operation
- [x] 7.6 Test lifecycle methods wrap domain operations correctly
- [x] 7.7 Test listing methods

## 8. Validation

- [x] 8.1 Run `bun test packages/core` - all tests pass (273 tests)
- [x] 8.2 Run `bun run typecheck` - no errors
- [x] 8.3 Run `bun run lint` - no errors (pre-existing warnings only)

## 9. Code Review Fixes (Added during implementation)

- [x] 9.1 Fix `getMemory()` to return Result type instead of throwing
- [x] 9.2 Add `NOT_IMPLEMENTED` to `CategoryErrorCode` type
- [x] 9.3 Clarify `reindex()` and `prune()` are store-wide operations in JSDoc
- [x] 9.4 Remove unused path validation from `reindex()` and `prune()`
- [x] 9.5 Add missing `@returns` JSDoc tags to navigation methods
- [x] 9.6 Improve error messages to include original error message
