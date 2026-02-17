# Change: Add CategoryClient

## Why

With `StoreClient` in place, we need `CategoryClient` to complete the navigation hierarchy. Categories are the aggregate root for memories - all memory access flows through categories. The client provides navigation, lifecycle operations, listing, and store-wide operations (reindex, prune).

## What Changes

- **Add `CategoryClient` class** in `packages/core/src/cortex/`
- **Update `StoreClient.rootCategory()`** to return real `CategoryClient`
- **Add path normalization** - canonical format with leading slash
- **Implement lazy validation** - invalid paths error on first async operation

## Impact

- Affected specs: `add-store-registry-and-resolution`
- Affected code:
    - `packages/core/src/cortex/category-client.ts` - new file
    - `packages/core/src/cortex/store-client.ts` - update `rootCategory()`
    - `packages/core/src/cortex/index.ts` - export `CategoryClient`
    - Tests for `StoreClient` and new `CategoryClient` tests
