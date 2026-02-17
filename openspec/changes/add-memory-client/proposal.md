# Change: Add MemoryClient

## Why

`MemoryClient` completes the fluent client hierarchy. It provides lifecycle operations (create, get, update, delete, exists) and movement for individual memories. With this in place, the full Azure SDK-style pattern is available.

## What Changes

- **Add `MemoryClient` class** in `packages/core/src/cortex/`
- **Update `CategoryClient.getMemory()`** to return real `MemoryClient`
- **Implement lazy validation** - invalid slugs error on first async operation

## Impact

- Affected specs: `add-store-registry-and-resolution`
- Affected code:
    - `packages/core/src/cortex/memory-client.ts` - new file
    - `packages/core/src/cortex/category-client.ts` - update `getMemory()`
    - `packages/core/src/cortex/index.ts` - export `MemoryClient`
    - Tests for `CategoryClient` and new `MemoryClient` tests
