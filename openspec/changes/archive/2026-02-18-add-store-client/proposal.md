# Change: Add StoreClient

## Why

The current `Cortex.getStore()` returns a `ScopedStorageAdapter` which exposes low-level storage interfaces. We want a fluent, Azure SDK-style client hierarchy where `getStore()` returns a `StoreClient` that provides navigation to categories and exposes store metadata.

## What Changes

- **Add `StoreClient` class** in `packages/core/src/cortex/`
- **Update `Cortex.getStore()`** to return `StoreClient` instead of `ScopedStorageAdapter`
- **BREAKING**: Callers accessing `cortex.getStore(name).value.memories.*` must update to use `StoreClient` API

## Impact

- Affected specs: `add-store-registry-and-resolution`
- Affected code:
    - `packages/core/src/cortex/cortex.ts` - update `getStore()` return type
    - `packages/core/src/cortex/store-client.ts` - new file
    - `packages/core/src/cortex/index.ts` - export `StoreClient`
    - All MCP handlers using `ctx.cortex.getStore()`
    - All CLI handlers using `cortex.getStore()`
    - All tests using `getStore()`
