# Tasks: Add MemoryClient

## 1. Create MemoryClient Class

- [ ] 1.1 Create `packages/core/src/cortex/memory-client.ts`
- [ ] 1.2 Define `MemoryClient` class with `readonly rawPath: string` and `readonly rawSlug: string`
- [ ] 1.3 Add `parsePath(): Result<MemoryPath, PathError>` method
- [ ] 1.4 Add `parseSlug(): Result<Slug, PathError>` method
- [ ] 1.5 Add JSDoc documentation with examples

## 2. Lifecycle Methods

- [ ] 2.1 Implement `create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>` - wraps `createMemory`
- [ ] 2.2 Implement `get(options?): Promise<Result<Memory, MemoryError>>` - wraps `getMemory`
- [ ] 2.3 Implement `update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>` - wraps `updateMemory`
- [ ] 2.4 Implement `delete(): Promise<Result<void, MemoryError>>` - wraps `removeMemory`
- [ ] 2.5 Implement `exists(): Promise<Result<boolean, MemoryError>>` - checks memory existence

## 3. Movement

- [ ] 3.1 Implement `move(destination: MemoryClient | MemoryPath): Promise<Result<MemoryClient, MemoryError>>`
- [ ] 3.2 Return new `MemoryClient` pointing to destination path

## 4. Update CategoryClient

- [ ] 4.1 Update `CategoryClient.getMemory()` to return real `MemoryClient`
- [ ] 4.2 Construct `MemoryClient` with full path (category + slug)

## 5. Write Tests

- [ ] 5.1 Create `packages/core/src/cortex/memory-client.spec.ts`
- [ ] 5.2 Test `rawPath` and `rawSlug` are correct
- [ ] 5.3 Test `parsePath()` and `parseSlug()` return valid value objects
- [ ] 5.4 Test lazy validation - invalid slug errors on first async operation
- [ ] 5.5 Test lifecycle methods wrap domain operations correctly
- [ ] 5.6 Test `move()` with `MemoryClient` destination
- [ ] 5.7 Test `move()` with `MemoryPath` destination
- [ ] 5.8 Test `move()` returns new client with correct path

## 6. Integration Tests

- [ ] 6.1 Test full navigation: `cortex.getStore().rootCategory().getCategory().getMemory()`
- [ ] 6.2 Test create flow: `getMemory().create()` then `get()`
- [ ] 6.3 Test update flow: `get()` then `update()`
- [ ] 6.4 Test move flow: `move()` then verify old path doesn't exist

## 7. Validation

- [ ] 7.1 Run `bun test packages/core` - all tests pass
- [ ] 7.2 Run `bun run typecheck` - no errors
- [ ] 7.3 Run `bun run lint` - no errors
