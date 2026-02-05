## 1. Implementation

- [x] 1.1 Add `reindexStoreInputSchema` Zod schema in `packages/server/src/memory/tools.ts`
- [x] 1.2 Add `ReindexStoreInput` TypeScript interface
- [x] 1.3 Implement `reindexStoreHandler` function that delegates to `adapter.indexes.reindex()`
- [x] 1.4 Register `cortex_reindex_store` tool in `registerMemoryTools`

## 2. Testing

- [x] 2.1 Add unit tests for `reindexStoreHandler` in `packages/server/src/memory/tools.spec.ts`
- [x] 2.2 Test success scenario (valid store, indexes rebuilt)
- [x] 2.3 Test error scenario (non-existent store)
- [x] 2.4 Test schema validation (missing store parameter)

## 3. Verification

- [x] 3.1 Run existing test suite to ensure no regressions (865 tests pass)
- [ ] 3.2 Manually test the new tool via MCP inspector or direct invocation
