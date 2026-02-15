# Change: Introduce Cortex Root Client

## Why

The current `FilesystemRegistry` is instantiated directly in 10+ locations across CLI and Server packages, with duplicated boilerplate code for loading and error handling. This tight coupling makes testing difficult, creates inconsistent error handling, and prevents dependency injection. The Registry also operates separately from `CortexConfig`, requiring consumers to manage two config systems.

## What Changes

- **Rename `Registry` interface to `Cortex` class** - becomes the root client for the memory system
- **Rename `StoreRegistry` type to `Registry`** - now just represents the collection of stores
- **Merge config files** - combine `config.yaml` (settings) and `stores.yaml` (store definitions) into single `config.yaml`
- **Add factory methods** - `Cortex.fromConfig(path)` to load a config from the file system, and `Cortex.init(options)` for programmatic creation
- **Add `CortexContext` pattern** - shared context object as first parameter to all handlers
- **Add `adapterFactory` option** - enables mock adapter injection for testing, and allows future support for non-filesystem storage backends
- **BREAKING**: Remove `FilesystemRegistry` class (logic moves into `Cortex.fromConfig()`)
- **BREAKING**: Remove separate `stores.yaml` file (merged into `config.yaml`)

## Impact

- Affected specs: `config`, `add-store-registry-and-resolution`, `storage-filesystem`
- Affected code:
    - `packages/core/src/storage/adapter.ts` - new Cortex class
    - `packages/core/src/config.ts` - merged config schema
    - `packages/storage-fs/src/filesystem-registry.ts` - removed, logic moves to Cortex
    - `packages/cli/src/context.ts` - use CortexContext pattern
    - `packages/cli/src/commands/**` - update handler signatures
    - `packages/server/src/**` - update tool handlers
    - All tests using FilesystemRegistry directly
