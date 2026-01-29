## Brainstorming Session Summary

**Date:** January 29, 2026  
**Participant:** Jesse Wellenberg  
**Topic:** Refactoring MCP Server to Use Domain Operations

---

### Problem Statement

The MCP server (`src/server/memory/tools.ts`) directly manipulates the filesystem instead of using domain operations from the core model. This causes:

- Scattered business logic
- Potential code duplication
- Harder testability
- Reduced portability (tightly coupled to filesystem)
- Code that's harder to reason about

The domain model should drive logic; the MCP server should just expose it through an MCP interface.

---

### Agreed Design

#### Phase 1: MCP Tools Use Memory Domain Operations

**Goal:** Refactor `tools.ts` to call domain operations from `src/core/memory/operations.ts`

- MCP server obtains adapters via `registry.getStore(storeName)`
- Domain operations (`createMemory`, `getMemory`, `updateMemory`, etc.) already exist and accept `ComposedStorageAdapter`
- MCP tools become thin wrappers: parse input → call domain operation → format response

---

#### Phase 2: Abstract the Registry

**Goal:** Make the store registry backend-agnostic (filesystem today, SQLite possible later)

**Renames:**

- `StoreStorage` → `Registry`
- `FilesystemStoreStorage` → `FilesystemRegistry`

**Registry Interface:**

```typescript
interface Registry {
    /** First-time setup - creates registry file/structure */
    initialize(): Promise<Result<void, RegistryError>>;

    /** Loads registry data (caches internally) */
    load(): Promise<Result<StoreRegistry, RegistryError>>;

    /** Persists registry data */
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;

    /** Factory method - returns scoped adapter for a store (sync, uses cached data) */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
}
```

**FilesystemRegistry:**

```typescript
class FilesystemRegistry implements Registry {
    constructor(registryPath: string) {}

    // Implements all Registry methods
    // getStore() resolves path from cached registry, returns FilesystemStorageAdapter
}
```

**ScopedStorageAdapter:**

```typescript
interface ScopedStorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
}
```

**File Changes:**

- `src/core/store/registry.ts` → Pure parsing/serialization only (remove `fs` imports)
- `src/core/storage/filesystem/store-storage.ts` → Rename to `filesystem-registry.ts`, implement full `Registry` interface with filesystem I/O
- Delete `src/core/store/store.ts` (superseded by registry-based approach)

---

#### New Domain Operation: `initializeStore`

**Purpose:** Initialize a new store with directory structure and indexes

**Signature:**

```typescript
initializeStore(
    registry: Registry,
    storeName: string,
    storePath: string,
    options?: { categories?: string[] }
): Promise<Result<void, InitStoreError>>
```

**Behavior:**

- Calls storage backend to create store directory/files
- Uses core modules to initialize indexes
- Adds entry to registry

**Used by:**

- `cortex init` (plus CLI creates `config.yaml` separately)
- `cortex store init`

---

### Key Design Decisions

| Decision                  | Choice                          | Rationale                                                         |
| ------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| Store factory location    | `registry.getStore()`           | Registry is source of truth for stores, natural place for factory |
| `getStore()` sync/async   | Synchronous with `Result`       | Adapter is just an entry point; registry caches loaded data       |
| Registry data caching     | Internal to registry (Option A) | Cleaner API, registry manages own state                           |
| Registry on adapter?      | Separate from adapter           | Adapter is for store content; registry is meta (about stores)     |
| `cortex init` config.yaml | CLI layer                       | CLI-specific concern, not domain                                  |
| Phase splitting           | Two phases                      | Manageable scope per change                                       |

---

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Server                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tools.ts (thin wrapper)                                  │   │
│  │  - Parse/validate input (Zod)                           │   │
│  │  - Call domain operations                               │   │
│  │  - Format MCP response                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Layer                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐    │
│  │ memory/operations.ts│    │ store/operations.ts (new)   │    │
│  │  - createMemory     │    │  - initializeStore          │    │
│  │  - getMemory        │    │                             │    │
│  │  - updateMemory     │    └─────────────────────────────┘    │
│  │  - moveMemory       │                                        │
│  │  - removeMemory     │                                        │
│  │  - listMemories     │                                        │
│  │  - pruneExpired     │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Layer                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Registry (interface)                                     │   │
│  │  - initialize()                                         │   │
│  │  - load() / save()                                      │   │
│  │  - getStore(name) → ScopedStorageAdapter                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ScopedStorageAdapter (interface)                        │   │
│  │  - memories: MemoryStorage                              │   │
│  │  - indexes: IndexStorage                                │   │
│  │  - categories: CategoryStorage                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│         ┌────────────────────┴────────────────────┐            │
│         ▼                                         ▼            │
│  ┌──────────────────┐                  ┌──────────────────┐    │
│  │FilesystemRegistry│                  │  (Future)        │    │
│  │                  │                  │  SqliteRegistry  │    │
│  └──────────────────┘                  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify/Create

**Phase 1:**

- Modify: `src/server/memory/tools.ts` - Use domain operations

**Phase 2:**

- Modify: `src/core/store/registry.ts` - Remove fs imports, pure parsing only
- Rename/Rewrite: `src/core/storage/filesystem/store-storage.ts` → `filesystem-registry.ts`
- Modify: `src/core/storage/adapter.ts` - Update interface names
- Create: `src/core/store/operations.ts` - `initializeStore` domain operation
- Modify: `src/cli/commands/init.ts` - Use `initializeStore`
- Modify: `src/cli/commands/store.ts` - Use `initializeStore`
- Delete: `src/core/store/store.ts`

---

### Open Items for Implementation

1. Error types for new operations (`RegistryError`, `InitStoreError`)
2. Test updates for renamed interfaces
3. Migration path for existing code using old names
