# Tasks: Cortex Root Client

## 1. Core Types and Interfaces

- [x] 1.1 Define `CortexSettings` interface in `packages/core/src/config.ts`
- [x] 1.2 Rename `StoreRegistry` type to `Registry` in `packages/core/src/store/registry.ts`
- [x] 1.3 Define `StoreDefinition` interface (path, description)
- [x] 1.4 Define `AdapterFactory` type alias
- [x] 1.5 Define `CortexOptions` interface
- [x] 1.6 Define `CortexContext` interface
- [x] 1.7 Update all imports affected by `StoreRegistry` → `Registry` rename

## 2. Merged Config Schema

- [x] 2.1 Update config schema to include `settings:` and `stores:` sections
- [x] 2.2 Write `parseConfig()` function for new merged format
- [x] 2.3 Write `serializeConfig()` function for new merged format
- [x] 2.4 Add validation for absolute store paths
- [x] 2.5 Add default values for `CortexSettings`
- [x] 2.6 Write tests for config parsing with merged format
- [x] 2.7 Write tests for config serialization

## 3. Cortex Class Implementation

- [x] 3.1 Create `Cortex` class in `packages/core/src/cortex.ts`
- [x] 3.2 Implement private constructor accepting `CortexOptions`
- [x] 3.3 Implement `static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>`
- [x] 3.4 Implement `static init(options: CortexOptions): Cortex`
- [x] 3.5 Implement `initialize(): Promise<Result<void, InitializeError>>`
- [x] 3.6 Implement `getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>`
- [x] 3.7 Add readonly properties: `rootDirectory`, `settings`, `registry`
- [x] 3.8 Write tests for `Cortex.init()` with default values
- [x] 3.9 Write tests for `Cortex.init()` with custom adapterFactory
- [x] 3.10 Write tests for `Cortex.fromConfig()` success case
- [x] 3.11 Write tests for `Cortex.fromConfig()` with missing config
- [x] 3.12 Write tests for `initialize()` idempotency
- [x] 3.13 Write tests for `getStore()` success and failure cases

## 4. CLI Migration

- [x] 4.1 Create `Cortex` instance at CLI entry point (`packages/cli/src/index.ts`)
- [x] 4.2 Define `CortexContext` and pass to command handlers
- [x] 4.3 Update `handleAdd` to accept `CortexContext` as first parameter
- [x] 4.4 Update `handleGet` to accept `CortexContext` as first parameter
- [x] 4.5 Update `handleUpdate` to accept `CortexContext` as first parameter
- [x] 4.6 Update `handleRemove` to accept `CortexContext` as first parameter
- [x] 4.7 Update `handleMove` to accept `CortexContext` as first parameter
- [x] 4.8 Update `handleList` to accept `CortexContext` as first parameter
- [x] 4.9 Update store command handlers to use `CortexContext`
- [x] 4.10 Update `handleInit` to use `Cortex.init()` and `initialize()`
- [x] 4.11 Remove direct `FilesystemRegistry` instantiation from `context.ts`
- [x] 4.12 Update CLI tests to use `Cortex.init()` with mock adapters

## 5. MCP Server Migration

- [x] 5.1 Create `Cortex` instance at server startup
- [x] 5.2 Create `CortexContext` and pass to tool handlers
- [x] 5.3 Update `resolveStoreAdapter` in `shared.ts` to use context
- [x] 5.4 Update memory tool handlers to use `CortexContext`
- [x] 5.5 Update store tool handlers to use `CortexContext`
- [x] 5.6 Update category tool handlers to use `CortexContext`
- [x] 5.7 Update health endpoint to use `CortexContext`
- [x] 5.8 Remove direct `FilesystemRegistry` instantiation
- [x] 5.9 Update server tests to use `Cortex.init()` with mock adapters

## 6. Cleanup and Migration

- [x] 6.1 Remove `FilesystemRegistry` class from `packages/storage-fs`
- [x] 6.2 Remove `stores.yaml` handling (merged into `config.yaml`)
- [x] 6.3 Update storage-fs exports
- [x] 6.4 Create migration guide for `stores.yaml` → `config.yaml`
- [x] 6.5 Update AGENTS.md with new patterns (N/A - no AGENTS.md in project)
- [x] 6.6 Run full test suite and fix any failures
- [x] 6.7 Update all documentation references

## 7. Validation

- [x] 7.1 Run `bun test` - all tests pass (687 tests)
- [x] 7.2 Run `bun run lint` - no errors (only pre-existing warnings)
- [x] 7.3 Run `bun run typecheck` - no errors
- [x] 7.4 Manual test: CLI commands work with new config format
- [x] 7.5 Manual test: MCP server starts and responds to tools
