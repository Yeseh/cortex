# Tasks: Add Scoped Prune and Reindex

## 1. Update Prune Operation

- [x] 1.1 Add required `scope: CategoryPath` parameter to `pruneExpiredMemories()`
- [x] 1.2 Update `pruneExpiredMemories()` to filter by scope
- [x] 1.3 Update existing callers to pass `CategoryPath.root()` for store-wide behavior
- [x] 1.4 Add tests for scoped pruning

## 2. Update Reindex Operation

- [x] 2.1 Add required `scope: CategoryPath` parameter to reindex
- [x] 2.2 Update reindex to only process subtree under scope
- [x] 2.3 Update existing callers to pass `CategoryPath.root()` for store-wide behavior
- [x] 2.4 Add tests for scoped reindexing

## 3. Update CategoryClient

- [x] 3.1 Update `CategoryClient.prune()` to pass parsed path as scope
- [x] 3.2 Update `CategoryClient.reindex()` to pass parsed path as scope
- [x] 3.3 Update JSDoc to reflect scoped behavior
- [x] 3.4 Update tests for new behavior

## 4. Validation

- [x] 4.1 Run `bun test packages/core` - all tests pass
- [x] 4.2 Run `bun run typecheck` - no errors
- [x] 4.3 Run `bun run lint` - no errors
