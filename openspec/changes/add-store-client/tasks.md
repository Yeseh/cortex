# Tasks: Add StoreClient

## 1. Create StoreClient Class

- [x] 1.1 Create `packages/core/src/cortex/store-client.ts`
- [x] 1.2 Define `StoreClient` class with readonly `name`, `path`, `description?` properties
- [x] 1.3 Add `rootCategory(): CategoryClient` method (returns real CategoryClient)
- [x] 1.4 Add JSDoc documentation with examples
- [x] 1.5 Export from `packages/core/src/cortex/index.ts`

## 2. Update Cortex Class

- [x] 2.1 Update `Cortex.getStore()` to return `Result<StoreClient, StoreNotFoundError>`
- [x] 2.2 Update `StoreClient` constructor to accept `ScopedStorageAdapter` internally
- [x] 2.3 Add `StoreClient.adapter` as internal property with `getAdapter()` escape hatch
- [x] 2.4 Update Cortex class JSDoc examples

## 3. Write Tests

- [x] 3.1 Create `packages/core/src/cortex/store-client.spec.ts`
- [x] 3.2 Test `StoreClient` properties are readonly and correct
- [x] 3.3 Test `rootCategory()` returns a `CategoryClient`
- [x] 3.4 Test `Cortex.getStore()` returns `StoreClient`

## 4. Validation

- [x] 4.1 Run `bun test packages/core` - all 290 tests pass
- [x] 4.2 Run `bun run typecheck` - no errors
- [x] 4.3 Run `bun run lint` - no errors (pre-existing warnings only)

## 5. Code Review Fixes

- [x] 5.1 Add missing `getAdapter()` test for full coverage

## Notes

- CategoryClient already exists, so `rootCategory()` returns a real CategoryClient
- MCP/CLI migration happens after all three clients exist to minimize churn
