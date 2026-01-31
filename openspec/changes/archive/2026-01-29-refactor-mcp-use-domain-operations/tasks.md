## 1. Preparation

- [x] 1.1 Review current domain operations in `src/core/memory/operations.ts`
- [x] 1.2 Review current MCP tool handlers in `src/server/memory/tools.ts`
- [x] 1.3 Identify gaps between domain operations and MCP tool needs

## 2. Refactor MCP Tool Handlers

- [x] 2.1 Refactor `addMemoryHandler` to use `createMemory` domain operation
- [x] 2.2 Refactor `getMemoryHandler` to use `getMemory` domain operation
- [x] 2.3 Refactor `updateMemoryHandler` to use `updateMemory` domain operation
- [x] 2.4 Refactor `removeMemoryHandler` to use `removeMemory` domain operation
- [x] 2.5 Refactor `moveMemoryHandler` to use `moveMemory` domain operation
- [x] 2.6 Refactor `listMemoriesHandler` to use `listMemories` domain operation
- [x] 2.7 Refactor `pruneMemoriesHandler` to use `pruneExpiredMemories` domain operation

## 3. Clean Up

- [x] 3.1 Remove direct `mkdir` calls from `tools.ts` (kept only in resolveStoreAdapter for store root creation)
- [x] 3.2 Remove duplicated serialization logic from `tools.ts`
- [x] 3.3 Remove `ROOT_CATEGORIES` constant (use from domain)
- [x] 3.4 Simplify helper functions that are no longer needed (removed `createAdapter`, `isExpired`)

## 4. Adapter Access

- [ ] 4.1 Update `ToolContext` to provide access to storage adapter (deferred - not needed for this refactoring)
- [x] 4.2 Update `resolveStoreRoot` to return a `ComposedStorageAdapter` instead of path (renamed to `resolveStoreAdapter`)
- [ ] 4.3 Update tool registration to pass adapter context (deferred - not needed for this refactoring)

## 5. Testing

- [x] 5.1 Verify all existing MCP tool tests pass (38/38 pass)
- [x] 5.2 Update tests if response formats changed (no changes needed)
- [x] 5.3 Run full test suite (939/939 pass)

## 6. Documentation

- [x] 6.1 Update code comments to reflect new architecture (added JSDoc, improved helper docs)

## Pull Request

- [x] PR created: https://github.com/Yeseh/cortex/pull/7
