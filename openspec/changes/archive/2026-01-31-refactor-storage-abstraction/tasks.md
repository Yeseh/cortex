## 1. Update CLI context for Registry support

- [x] 1.1 Add `resolveStoreAdapter` function to `src/cli/context.ts` that returns `ScopedStorageAdapter`
- [x] 1.2 Export `ScopedStorageAdapter` type re-export from context for convenience

## 2. Update CLI memory commands to use Registry pattern

- [x] 2.1 Update `memory add` command - use `resolveStoreAdapter` and `adapter.memories.write()`
- [x] 2.2 Update `memory remove` command - use `resolveStoreAdapter` and `adapter.memories.remove()`
- [x] 2.3 Update `memory list` command - use `resolveStoreAdapter` and `adapter.memories.list()`
- [x] 2.4 Update `memory show` command - use `resolveStoreAdapter` and `adapter.memories.read()`
- [x] 2.5 Update `memory move` command - use `resolveStoreAdapter` and `adapter.memories.move()`
- [x] 2.6 Update `memory update` command - use `resolveStoreAdapter`

## 3. Update CLI store commands to use Registry pattern

- [x] 3.1 Update `store reindex` command - use `resolveStoreAdapter` and `adapter.indexes.reindex()`
- [x] 3.2 Update `store prune` command - use `resolveStoreAdapter`

## 4. Update MCP Server to use Registry fully

- [x] 4.1 Update `resolveStoreAdapter` in `memory/tools.ts` to use `registry.getStore()`
- [x] 4.2 Update memory tool handlers to use `ScopedStorageAdapter` interface
- [x] 4.3 Update `category/tools.ts` to use Registry pattern
- [x] 4.4 Update `memory/resources.ts` to use Registry pattern

## 5. Validation

- [x] 5.1 Verify no direct `new FilesystemStorageAdapter` in CLI commands or Server tools (except context.ts fallback)
- [x] 5.2 Run test suite: `bun test` - All 860 tests pass
- [x] 5.3 Code review completed - issues addressed
