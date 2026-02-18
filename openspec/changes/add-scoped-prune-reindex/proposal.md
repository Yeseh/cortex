# Change: Add scoped prune and reindex operations

## Why

Currently `CategoryClient.prune()` and `CategoryClient.reindex()` operate on the entire store regardless of which category they're called from. The JSDoc documents this behavior, but it's counterintuitive - users expect calling `category.prune()` to prune only that subtree.

## What Changes

- Add optional `scope?: CategoryPath` parameter to `pruneExpiredMemories()` operation
- Add optional `scope?: CategoryPath` parameter to reindex operations
- When scope is provided, only process memories/categories under that path
- Default behavior (no scope) remains store-wide for backwards compatibility
- Update `CategoryClient.prune()` to pass `this.parsePath()` as scope
- Update `CategoryClient.reindex()` to pass `this.parsePath()` as scope

## Impact

- Affected specs: `specs/category-client/spec.md`
- Affected code:
    - `packages/core/src/memory/operations/prune.ts`
    - `packages/core/src/cortex/category-client.ts`
    - Index reindex operations in storage adapter
