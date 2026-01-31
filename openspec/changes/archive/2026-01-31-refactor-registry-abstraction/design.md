## Context

The store registry manages the mapping of store names to their storage locations. Currently, the `StoreStorage` interface and `FilesystemStoreStorage` implementation are tightly coupled to filesystem paths being passed to each method. This design doesn't scale to alternative backends (e.g., SQLite where the "registry" is a table).

Additionally, there's no clean factory pattern for obtaining storage adapters scoped to specific stores.

## Goals

- Backend-agnostic registry interface
- Registry as the factory for scoped storage adapters
- Clean separation: `registry.ts` = parsing, `FilesystemRegistry` = I/O
- Support `cortex init` and `cortex store init` through domain operations

## Non-Goals

- Implementing SQLite backend (future work)
- Changing user-facing CLI interfaces
- Changing MCP tool interfaces

## Decisions

### Registry Caches Loaded Data

The registry loads data once via `load()` and caches it internally. This enables `getStore(name)` to be synchronous.

```typescript
const registry = new FilesystemRegistry(path);
await registry.load(); // Loads and caches
const adapter = registry.getStore('my-project'); // Sync, uses cache
```

**Rationale:** Cleaner API where registry manages its own state. Avoids passing registry data around.

### ScopedStorageAdapter vs ComposedStorageAdapter

`getStore(name)` returns a `ScopedStorageAdapter` which has only:

- `memories: MemoryStorage`
- `indexes: IndexStorage`
- `categories: CategoryStorage`

It does NOT have `stores` or registry access - you're already scoped to a store.

**Rationale:** Type-honest about capabilities. Clear separation between registry (meta) and adapter (content).

### initializeStore as Domain Operation

Store initialization logic lives in `src/core/store/operations.ts`, not in CLI commands. This enables both `cortex init` and `cortex store init` to share the same logic.

The CLI layer only handles CLI-specific concerns like creating `config.yaml` for global init.

## Risks / Trade-offs

| Risk                         | Mitigation                                          |
| ---------------------------- | --------------------------------------------------- |
| Breaking internal interfaces | No user-facing changes; update all internal usages  |
| Caching complexity           | Simple cache invalidation: `load()` refreshes cache |
| Test updates required        | Comprehensive test pass after changes               |

## Open Questions

None - design agreed in brainstorming session.
