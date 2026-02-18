# Tasks: Add Scoped Prune and Reindex

## 1. Update Prune Operation

- [ ] 1.1 Add optional `scope?: CategoryPath` parameter to `PruneOptions`
- [ ] 1.2 Update `pruneExpiredMemories()` to filter by scope when provided
- [ ] 1.3 Add tests for scoped pruning

## 2. Update Reindex Operation

- [ ] 2.1 Add optional `scope?: CategoryPath` parameter to reindex
- [ ] 2.2 Update reindex to only process subtree when scope provided
- [ ] 2.3 Add tests for scoped reindexing

## 3. Update CategoryClient

- [ ] 3.1 Update `CategoryClient.prune()` to pass parsed path as scope
- [ ] 3.2 Update `CategoryClient.reindex()` to pass parsed path as scope
- [ ] 3.3 Update JSDoc to reflect scoped behavior
- [ ] 3.4 Update tests for new behavior

## 4. Validation

- [ ] 4.1 Run `bun test packages/core` - all tests pass
- [ ] 4.2 Run `bun run typecheck` - no errors
- [ ] 4.3 Run `bun run lint` - no errors
