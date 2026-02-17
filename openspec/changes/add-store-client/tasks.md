# Tasks: Add StoreClient

## 1. Create StoreClient Class

- [ ] 1.1 Create `packages/core/src/cortex/store-client.ts`
- [ ] 1.2 Define `StoreClient` class with readonly `name`, `path`, `description?` properties
- [ ] 1.3 Add `rootCategory(): CategoryClient` method (stub returning placeholder until CategoryClient exists)
- [ ] 1.4 Add JSDoc documentation with examples
- [ ] 1.5 Export from `packages/core/src/cortex/index.ts`

## 2. Update Cortex Class

- [ ] 2.1 Update `Cortex.getStore()` to return `Result<StoreClient, StoreNotFoundError>`
- [ ] 2.2 Update `StoreClient` constructor to accept `ScopedStorageAdapter` internally
- [ ] 2.3 Add `StoreClient.adapter` as internal property (not public API) for domain operations
- [ ] 2.4 Update Cortex class JSDoc examples

## 3. Write Tests

- [ ] 3.1 Create `packages/core/src/cortex/store-client.spec.ts`
- [ ] 3.2 Test `StoreClient` properties are readonly and correct
- [ ] 3.3 Test `rootCategory()` returns a `CategoryClient` (once available)
- [ ] 3.4 Test `Cortex.getStore()` returns `StoreClient`

## 4. Validation

- [ ] 4.1 Run `bun test packages/core` - all tests pass
- [ ] 4.2 Run `bun run typecheck` - no errors
- [ ] 4.3 Run `bun run lint` - no errors

## Notes

- This change creates a temporary stub for `rootCategory()` since `CategoryClient` doesn't exist yet
- MCP/CLI migration happens after all three clients exist to minimize churn
