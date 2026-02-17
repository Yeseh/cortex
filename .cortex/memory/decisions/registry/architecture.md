---
{created_at: 2026-02-17T19:14:59.271Z,updated_at: 2026-02-17T19:14:59.271Z,tags: [decision,architecture,registry,storage,factory-pattern],source: mcp}
---
# Registry Architecture

**Date:** 2026-01-29 to 2026-01-31
**PRs:** #9 (merged)

## Context
The store registry was tightly coupled to filesystem operations, making it difficult to test and potentially support alternative backends. Multiple refactoring decisions were made to establish a clean registry abstraction.

## Decisions

### 1. Registry as Store Factory
The `Registry` interface serves as both the store registry AND the factory for storage adapters via `registry.getStore(name)`.

**Rationale:**
- Registry is the source of truth for store paths/configuration
- Natural place for the factory method
- Keeps adapter focused on storage operations only
- Registry can cache loaded data, making `getStore()` synchronous

### 2. Interface Naming
Renamed for clarity:
- `StoreStorage` → `Registry`
- `FilesystemStoreStorage` → `FilesystemRegistry`

### 3. Registry Interface
```typescript
interface Registry {
    initialize(): Promise<Result<void, RegistryError>>;
    load(): Promise<Result<StoreRegistry, RegistryError>>;
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;  // Sync
}
```

### 4. Store List from Registry
The `cortex_list_stores` MCP tool reads from `stores.yaml` registry file (not filesystem directories), enabling store descriptions and future configuration.

## Key Design Notes
- `store.ts` was **NOT deleted** because `resolveStore` provides local/global fallback resolution (different from `registry.getStore()`)
- Memory operations now accept `ScopedStorageAdapter` instead of `ComposedStorageAdapter`
- Registry caches data internally for synchronous `getStore()` after async `load()`

## File Locations
- Interface: `packages/core/src/storage/adapter.ts`
- Implementation: `packages/storage-fs/src/filesystem-registry.ts`
- Domain operation: `packages/core/src/store/operations.ts`

## Related
- `.context/registry-brainstorm.md` - Full brainstorming session