# Tasks: Add CategoryClient

## 1. Create CategoryClient Class

- [ ] 1.1 Create `packages/core/src/cortex/category-client.ts`
- [ ] 1.2 Define `CategoryClient` class with `readonly rawPath: string`
- [ ] 1.3 Add `parsePath(): Result<CategoryPath, PathError>` method
- [ ] 1.4 Add path normalization helper (leading slash, no trailing, collapse multiple)
- [ ] 1.5 Add JSDoc documentation with examples

## 2. Navigation Methods

- [ ] 2.1 Implement `getCategory(path: string): CategoryClient` - relative path navigation
- [ ] 2.2 Implement `getMemory(slug: string): MemoryClient` (stub until MemoryClient exists)
- [ ] 2.3 Implement `parent(): CategoryClient | null` - returns null when `rawPath === '/'`

## 3. Lifecycle Methods

- [ ] 3.1 Implement `create(): Promise<Result<Category, CategoryError>>` - wraps `createCategory`
- [ ] 3.2 Implement `delete(): Promise<Result<void, CategoryError>>` - wraps `deleteCategory` (always recursive)
- [ ] 3.3 Implement `exists(): Promise<Result<boolean, CategoryError>>` - checks category existence

## 4. Metadata and Listing Methods

- [ ] 4.1 Implement `setDescription(description: string | null): Promise<Result<void, CategoryError>>`
- [ ] 4.2 Implement `listMemories(options?): Promise<Result<MemoryInfo[], CategoryError>>`
- [ ] 4.3 Implement `listSubcategories(): Promise<Result<CategoryInfo[], CategoryError>>`

## 5. Store-wide Operations

- [ ] 5.1 Implement `reindex(): Promise<Result<ReindexResult, CategoryError>>` - scoped to subtree
- [ ] 5.2 Implement `prune(options?): Promise<Result<PruneResult, CategoryError>>` - scoped to subtree

## 6. Update StoreClient

- [ ] 6.1 Update `StoreClient.rootCategory()` to return real `CategoryClient` with `rawPath: '/'`
- [ ] 6.2 Pass `ScopedStorageAdapter` to `CategoryClient` constructor

## 7. Write Tests

- [ ] 7.1 Create `packages/core/src/cortex/category-client.spec.ts`
- [ ] 7.2 Test path normalization (leading slash, trailing slash, multiple slashes)
- [ ] 7.3 Test `getCategory()` path concatenation
- [ ] 7.4 Test `parent()` navigation including null at root
- [ ] 7.5 Test lazy validation - invalid path errors on first async operation
- [ ] 7.6 Test lifecycle methods wrap domain operations correctly
- [ ] 7.7 Test listing methods

## 8. Validation

- [ ] 8.1 Run `bun test packages/core` - all tests pass
- [ ] 8.2 Run `bun run typecheck` - no errors
- [ ] 8.3 Run `bun run lint` - no errors
