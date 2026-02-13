---
created_at: 2026-01-29T19:53:57.453Z
updated_at: 2026-01-29T19:53:57.453Z
tags:
  - decision
  - naming
  - registry
  - refactoring
source: mcp
---
# Registry Interface Rename

**Date:** 2026-01-29

## Decision
Rename storage registry interfaces for clarity:
- `StoreStorage` → `Registry`
- `FilesystemStoreStorage` → `FilesystemRegistry`

## Context
The original names were confusing:
- "StoreStorage" sounds like it stores stores, not that it's a registry of stores
- The interface manages store metadata, not store content

## New Interface
```typescript
interface Registry {
    initialize(): Promise<Result<void, RegistryError>>;
    load(): Promise<Result<StoreRegistry, RegistryError>>;
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
}
```

## Additional Changes
- `load()` and `save()` no longer take path parameter (internal to implementation)
- Added `initialize()` for first-time registry setup
- Added `getStore()` as factory method (see registry-as-store-factory decision)

## Migration
- Update all imports and usages
- `src/core/store/registry.ts` becomes pure parsing/serialization
- `src/core/storage/filesystem/store-storage.ts` → `filesystem-registry.ts`

## Related
- `.context/registry-brainstorm.md` - Full brainstorming session