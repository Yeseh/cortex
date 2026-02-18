# Tasks: Add MemoryClient

## 1. Create MemoryClient Class

- [x] 1.1 Create `packages/core/src/cortex/memory-client.ts`
- [x] 1.2 Define `MemoryClient` class with `readonly rawPath: string` and `readonly rawSlug: string`
- [x] 1.3 Add `parsePath(): Result<MemoryPath, PathError>` method
- [x] 1.4 Add `parseSlug(): Result<Slug, PathError>` method
- [x] 1.5 Add JSDoc documentation with examples

## 2. Lifecycle Methods

- [x] 2.1 Implement `create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>` - wraps `createMemory`
- [x] 2.2 Implement `get(options?): Promise<Result<Memory, MemoryError>>` - wraps `getMemory`
- [x] 2.3 Implement `update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>` - wraps `updateMemory`
- [x] 2.4 Implement `delete(): Promise<Result<void, MemoryError>>` - wraps `removeMemory`
- [x] 2.5 Implement `exists(): Promise<Result<boolean, MemoryError>>` - checks memory existence

## 3. Movement

- [x] 3.1 Implement `move(destination: MemoryClient | MemoryPath): Promise<Result<MemoryClient, MemoryError>>`
- [x] 3.2 Return new `MemoryClient` pointing to destination path

## 4. Update CategoryClient

- [x] 4.1 Update `CategoryClient.getMemory()` to return real `MemoryClient`
- [x] 4.2 Construct `MemoryClient` with full path (category + slug)

## 5. Write Tests

- [x] 5.1 Create `packages/core/src/cortex/memory-client.spec.ts`
- [x] 5.2 Test `rawPath` and `rawSlug` are correct
- [x] 5.3 Test `parsePath()` and `parseSlug()` return valid value objects
- [x] 5.4 Test lazy validation - invalid slug errors on first async operation
- [x] 5.5 Test lifecycle methods wrap domain operations correctly
- [x] 5.6 Test `move()` with `MemoryClient` destination
- [x] 5.7 Test `move()` with `MemoryPath` destination
- [x] 5.8 Test `move()` returns new client with correct path

## 6. Integration Tests

- [x] 6.1 Test full navigation: `cortex.getStore().rootCategory().getCategory().getMemory()`
- [x] 6.2 Test create flow: `getMemory().create()` then `get()`
- [x] 6.3 Test update flow: `get()` then `update()`
- [x] 6.4 Test move flow: `move()` then verify old path doesn't exist

## 7. Validation

- [x] 7.1 Run `bun test packages/core` - all tests pass (328 tests)
- [x] 7.2 Run `bun run typecheck` - no errors
- [x] 7.3 Run `bun run lint` - no errors (pre-existing warnings only)

## 8. Code Review Fixes (Added during implementation)

- [x] 8.1 Add explicit `@returns` JSDoc tags to all async methods
- [x] 8.2 Add class-level note about Result-based error handling
- [x] 8.3 Document rawSlug vs parsed slug normalization divergence
