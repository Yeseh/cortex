# Tasks: Add Cortex class

## 1. Core Types

- [ ] 1.1 Rename `StoreRegistry` type to `Registry` in `packages/core/src/store/registry.ts`
- [ ] 1.2 Define `StoreDefinition` interface (path, description)
- [ ] 1.3 Define `AdapterFactory` type alias
- [ ] 1.4 Define `CortexOptions` interface
- [ ] 1.5 Update all imports affected by `StoreRegistry` → `Registry` rename

## 2. Cortex Class Implementation

- [ ] 2.1 Create `Cortex` class in `packages/core/src/cortex/cortex.ts`
- [ ] 2.2 Implement private constructor accepting `CortexOptions`
- [ ] 2.3 Implement `static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>`
- [ ] 2.4 Implement `static init(options: CortexOptions): Cortex`
- [ ] 2.5 Implement `initialize(): Promise<Result<void, InitializeError>>`
- [ ] 2.6 Implement `getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>`
- [ ] 2.7 Add readonly properties: `rootDirectory`, `settings`, `registry`

## 3. Tests

- [ ] 3.1 Write tests for `Cortex.init()` with default values
- [ ] 3.2 Write tests for `Cortex.init()` with custom adapterFactory
- [ ] 3.3 Write tests for `Cortex.fromConfig()` success case
- [ ] 3.4 Write tests for `Cortex.fromConfig()` with missing config
- [ ] 3.5 Write tests for `initialize()` idempotency
- [ ] 3.6 Write tests for `getStore()` success and failure cases

## 4. Validation

- [ ] 4.1 Run `bun test` - all tests pass
- [ ] 4.2 Run `bun run lint` - no errors
- [ ] 4.3 Run `bun run typecheck` - no errors
