## 1. Preparation

- [ ] 1.1 Review current domain operations in `src/core/memory/operations.ts`
- [ ] 1.2 Review current MCP tool handlers in `src/server/memory/tools.ts`
- [ ] 1.3 Identify gaps between domain operations and MCP tool needs

## 2. Refactor MCP Tool Handlers

- [ ] 2.1 Refactor `addMemoryHandler` to use `createMemory` domain operation
- [ ] 2.2 Refactor `getMemoryHandler` to use `getMemory` domain operation
- [ ] 2.3 Refactor `updateMemoryHandler` to use `updateMemory` domain operation
- [ ] 2.4 Refactor `removeMemoryHandler` to use `removeMemory` domain operation
- [ ] 2.5 Refactor `moveMemoryHandler` to use `moveMemory` domain operation
- [ ] 2.6 Refactor `listMemoriesHandler` to use `listMemories` domain operation
- [ ] 2.7 Refactor `pruneMemoriesHandler` to use `pruneExpiredMemories` domain operation

## 3. Clean Up

- [ ] 3.1 Remove direct `mkdir` calls from `tools.ts`
- [ ] 3.2 Remove duplicated serialization logic from `tools.ts`
- [ ] 3.3 Remove `ROOT_CATEGORIES` constant (use from domain)
- [ ] 3.4 Simplify helper functions that are no longer needed

## 4. Adapter Access

- [ ] 4.1 Update `ToolContext` to provide access to storage adapter
- [ ] 4.2 Update `resolveStoreRoot` to return a `ComposedStorageAdapter` instead of path
- [ ] 4.3 Update tool registration to pass adapter context

## 5. Testing

- [ ] 5.1 Verify all existing MCP tool tests pass
- [ ] 5.2 Update tests if response formats changed
- [ ] 5.3 Run full test suite

## 6. Documentation

- [ ] 6.1 Update code comments to reflect new architecture
