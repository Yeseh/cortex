## Context

The current `FilesystemStorageAdapter` is a monolithic class that implements memory, index, and category operations through a single interface. This violates the Interface Segregation Principle (ISP) - clients are forced to depend on methods they don't use.

The class has become a "pass-through facade" where most methods simply delegate to focused modules (`memories.ts`, `indexes.ts`, `categories.ts`) without adding value. The only shared state is `FilesystemContext`.

Additionally, `writeMemoryFile` currently auto-updates indexes, coupling memory persistence with index management. This should be a business layer concern.

Store registry operations (`loadStoreRegistry`, `saveStoreRegistry`, `removeStoreRegistry`) in `core/store/registry.ts` are standalone functions that should follow the same composition pattern for consistency.

## Goals / Non-Goals

**Goals:**

- Apply ISP by splitting into four focused interfaces
- Use composition ("has-a") instead of a monolithic class
- Simplify method names (context provided by property name)
- Move index coordination to business layer
- Include store registry operations in the same pattern
- Maintain backward compatibility through clear migration path

**Non-Goals:**

- Changing the underlying file format or storage layout
- Adding new storage backends (this is a refactor, not new functionality)
- Changing the `CategoryStorage` interface contract (already well-designed)

## Decisions

### Decision: Composition over inheritance

The `StorageAdapter` will use composition with four properties:

```typescript
interface StorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
    stores: StoreStorage;
}
```

**Rationale:** This allows consumers to depend only on the interface they need. A service that only reads memories can accept `MemoryStorage` directly.

### Decision: Simplified method names

Methods will use short names since the property provides context:

- `adapter.memories.read(path)` instead of `adapter.readMemoryFile(path)`
- `adapter.indexes.write(name, contents)` instead of `adapter.writeIndexFile(name, contents)`
- `adapter.stores.load(path)` instead of `loadStoreRegistry(path)`

**Rationale:** Reduces redundancy and improves readability.

### Decision: Shared FilesystemContext

All four filesystem implementations receive the same `FilesystemContext` in their constructors. The `FilesystemStorageAdapter` creates the context once and passes it to each implementation.

**Rationale:** The context contains shared configuration (root path, extensions) that all implementations need.

### Decision: Business layer owns index coordination

The `memories.write()` method will NOT auto-update indexes. Callers must explicitly update indexes when needed.

**Rationale:**

- Follows single responsibility principle
- Makes the data flow explicit
- Allows callers to batch index updates or skip them when appropriate

### Decision: Store storage interface

The `StoreStorage` interface wraps the existing registry functions:

```typescript
interface StoreStorage {
    load(
        path: string,
        options?: { allowMissing?: boolean }
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>>;
    save(path: string, registry: StoreRegistry): Promise<Result<void, StoreRegistrySaveError>>;
    remove(path: string): Promise<Result<void, StoreRegistrySaveError>>;
}
```

**Rationale:** Consistency with other storage interfaces. The existing functions in `registry.ts` can be reused internally.

## Risks / Trade-offs

| Risk                                             | Mitigation                                                      |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Breaking change for all consumers                | Clear migration guide, update all internal consumers in same PR |
| Forgetting to update indexes after memory writes | Add documentation, consider helper function for common pattern  |
| Increased verbosity for simple operations        | The explicitness is a feature - makes data flow clear           |

## Migration Plan

1. Add new interfaces alongside existing ones
2. Implement new classes
3. Update `FilesystemStorageAdapter` to compose new classes
4. Update all consumers in the same PR
5. Remove old interface methods

**Rollback:** Revert the PR. No data migration needed since storage format unchanged.

## Open Questions

None - design approved by handler.
