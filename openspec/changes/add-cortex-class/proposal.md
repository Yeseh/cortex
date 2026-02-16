# Change: Add Cortex class

## Why

After merging config files, the system needs a clean root client API to load configuration and provide access to stores. Currently `FilesystemRegistry` handles this but couples directly to filesystem operations, making testing difficult.

## What Changes

- **Add `Cortex` class** - root client with `fromConfig()` and `init()` factory methods
- **Add `CortexOptions` interface** - programmatic creation options
- **Add `AdapterFactory` type** - enables mock adapter injection for testing
- **Rename `StoreRegistry` to `Registry`** - simpler name for store collection type
- `FilesystemRegistry` remains functional (removal in next proposal)

## Impact

- Affected specs: `add-store-registry-and-resolution`, `storage-filesystem`
- Affected code:
    - `packages/core/src/cortex/` - new Cortex class
    - `packages/core/src/store/registry.ts` - rename type
    - `packages/storage-fs/src/` - add AdapterFactory type
