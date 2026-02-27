# Registry Abstraction Refactoring Implementation Plan

**Goal:** Abstract the store registry to be backend-agnostic and establish it as the factory for scoped storage adapters
**Architecture:** Registry interface with FilesystemRegistry implementation, ScopedStorageAdapter for store-scoped operations, domain operations for store initialization
**Tech Stack:** TypeScript, Bun, Result pattern for error handling
**Session Id:** ses_3ebf0bc99ffeY2B0x0nMeaYYyh

---

## Implementation Groups

### Group 1: Interface Definitions (Tasks 1.1-1.4)

Dependencies: None
Can be implemented in parallel with Group 2 preparation

### Group 2: Pure Registry Parsing (Tasks 2.1-2.6)

Dependencies: Group 1 (for error types)
Must complete before Group 3

### Group 3: FilesystemRegistry (Tasks 3.1-3.7)

Dependencies: Group 1 (interfaces), Group 2 (pure functions)
Must complete before Groups 4, 5

### Group 4: Domain Operations (Tasks 4.1-4.5)

Dependencies: Group 3 (FilesystemRegistry)
Can run in parallel with Groups 5, 6

### Group 5: CLI Updates (Tasks 5.1-5.4)

Dependencies: Group 3 (FilesystemRegistry), Group 4 (initializeStore)
Can run in parallel with Group 6

### Group 6: MCP Server Updates (Tasks 7.1-7.2)

Dependencies: Group 3 (FilesystemRegistry)
Can run in parallel with Groups 4, 5

### Group 7: Cleanup (Tasks 6.1-6.4)

Dependencies: Groups 4, 5, 6 (all consumers updated)
Must be last code change

### Group 8: Testing (Tasks 8.1-8.5)

Dependencies: Groups 1-7 (all implementation complete)

### Group 9: Documentation (Tasks 9.1-9.2)

Dependencies: Groups 1-8 (implementation and tests complete)

---

## Detailed Task Breakdown

### Group 1: Interface Definitions

#### Task 1.1: Define Registry interface in adapter.ts

**File:** `src/core/storage/adapter.ts`
**Action:** Add new Registry interface with:

- `initialize(): Promise<Result<void, RegistryError>>`
- `load(): Promise<Result<StoreRegistry, RegistryError>>`
- `save(registry: StoreRegistry): Promise<Result<void, RegistryError>>`
- `getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>`

```typescript
// Add after ComposedStorageAdapter interface

/**
 * Registry interface for managing store configurations.
 *
 * Implementations cache loaded data internally, enabling synchronous
 * getStore() calls after load().
 */
export interface Registry {
    /** First-time registry setup */
    initialize(): Promise<Result<void, RegistryError>>;
    /** Load registry data (caches internally) */
    load(): Promise<Result<StoreRegistry, RegistryError>>;
    /** Persist registry data */
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;
    /** Synchronous factory returning scoped adapter */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;
}
```

#### Task 1.2: Define ScopedStorageAdapter interface

**File:** `src/core/storage/adapter.ts`
**Action:** Add ScopedStorageAdapter interface (subset of ComposedStorageAdapter without stores)

```typescript
/**
 * Storage adapter scoped to a specific store.
 *
 * Does not include store/registry operations - you're already scoped.
 */
export interface ScopedStorageAdapter {
    /** Memory file operations */
    memories: MemoryStorage;
    /** Index file operations and reindexing */
    indexes: IndexStorage;
    /** Category operations */
    categories: CategoryStorage;
}
```

#### Task 1.3: Define RegistryError type

**File:** `src/core/storage/adapter.ts`
**Action:** Add error types for Registry operations

```typescript
/** Error codes for registry operations */
export type RegistryErrorCode =
    | 'REGISTRY_MISSING'
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_WRITE_FAILED'
    | 'REGISTRY_PARSE_FAILED';

/** Error for registry operations */
export interface RegistryError {
    code: RegistryErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

/** Error when store is not found in registry */
export interface StoreNotFoundError {
    code: 'STORE_NOT_FOUND';
    message: string;
    store: string;
}
```

#### Task 1.4: Define InitStoreError type

**File:** `src/core/store/operations.ts` (new file)
**Action:** Define error type for store initialization

```typescript
export type InitStoreErrorCode =
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_CREATE_FAILED'
    | 'STORE_INDEX_FAILED'
    | 'REGISTRY_UPDATE_FAILED';

export interface InitStoreError {
    code: InitStoreErrorCode;
    message: string;
    store?: string;
    path?: string;
    cause?: unknown;
}
```

---

### Group 2: Pure Registry Parsing Refactor

#### Task 2.1: Remove fs imports from registry.ts

**File:** `src/core/store/registry.ts`
**Action:** Remove the fs imports at the top

```typescript
// REMOVE these lines:
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
```

#### Task 2.2: Remove loadStoreRegistry function

**File:** `src/core/store/registry.ts`
**Action:** Remove the loadStoreRegistry function (lines 491-529)
**Note:** This will move to FilesystemRegistry

#### Task 2.3: Remove saveStoreRegistry function

**File:** `src/core/store/registry.ts`
**Action:** Remove the saveStoreRegistry function (lines 531-557)
**Note:** This will move to FilesystemRegistry

#### Task 2.4: Remove removeStoreRegistry function

**File:** `src/core/store/registry.ts`
**Action:** Remove the removeStoreRegistry function (lines 559-572)
**Note:** This will move to FilesystemRegistry

#### Task 2.5: Keep pure functions

**File:** `src/core/store/registry.ts`
**Action:** Verify these are kept:

- `parseStoreRegistry`
- `serializeStoreRegistry`
- `isValidStoreName`
- `resolveStorePath`

#### Task 2.6: Remove isNotFoundError helper

**File:** `src/core/store/registry.ts`
**Action:** Remove isNotFoundError helper (lines 441-449) - moves to FilesystemRegistry

---

### Group 3: FilesystemRegistry Implementation

#### Task 3.1: Rename store-storage.ts to filesystem-registry.ts

**File:** `src/core/storage/filesystem/store-storage.ts` -> `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Rename file and update class name

#### Task 3.2: Update constructor to take registryPath parameter

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Update constructor signature

```typescript
export class FilesystemRegistry implements Registry {
    private cache: StoreRegistry | null = null;

    constructor(private readonly registryPath: string) {}
}
```

#### Task 3.3: Implement initialize() method

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Add initialize method for first-time setup

```typescript
async initialize(): Promise<Result<void, RegistryError>> {
    try {
        const dir = dirname(this.registryPath);
        await mkdir(dir, { recursive: true });
        // Create empty registry file
        const emptyRegistry: StoreRegistry = {};
        const serialized = serializeStoreRegistry(emptyRegistry);
        // ... handle errors and write
        await writeFile(this.registryPath, serialized.value, 'utf8');
        return ok(undefined);
    } catch (error) {
        return err({ code: 'REGISTRY_WRITE_FAILED', ... });
    }
}
```

#### Task 3.4: Implement load() method with caching

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Add load method that caches internally

```typescript
async load(): Promise<Result<StoreRegistry, RegistryError>> {
    try {
        const contents = await readFile(this.registryPath, 'utf8');
        const parsed = parseStoreRegistry(contents);
        if (!parsed.ok) {
            return err({ code: 'REGISTRY_PARSE_FAILED', ... });
        }
        this.cache = parsed.value;
        return ok(parsed.value);
    } catch (error) {
        if (isNotFoundError(error)) {
            return err({ code: 'REGISTRY_MISSING', ... });
        }
        return err({ code: 'REGISTRY_READ_FAILED', ... });
    }
}
```

#### Task 3.5: Implement save(registry) method

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Add save method

```typescript
async save(registry: StoreRegistry): Promise<Result<void, RegistryError>> {
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok) {
        return err({ code: 'REGISTRY_WRITE_FAILED', message: 'Failed to serialize' });
    }
    try {
        await mkdir(dirname(this.registryPath), { recursive: true });
        await writeFile(this.registryPath, serialized.value, 'utf8');
        this.cache = registry;
        return ok(undefined);
    } catch (error) {
        return err({ code: 'REGISTRY_WRITE_FAILED', ... });
    }
}
```

#### Task 3.6: Implement getStore(name) synchronous factory

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Add synchronous factory method

```typescript
getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
    if (!this.cache) {
        throw new Error('Registry not loaded. Call load() first.');
    }
    const store = this.cache[name];
    if (!store) {
        return err({
            code: 'STORE_NOT_FOUND',
            message: `Store '${name}' is not registered.`,
            store: name,
        });
    }
    // Create FilesystemStorageAdapter scoped to store path
    const adapter = new FilesystemStorageAdapter({ rootDirectory: store.path });
    return ok({
        memories: adapter.memories,
        indexes: adapter.indexes,
        categories: adapter.categories,
    });
}
```

#### Task 3.7: Add private cache field

**File:** `src/core/storage/filesystem/filesystem-registry.ts`
**Action:** Ensure cache field is defined (done in 3.2)

---

### Group 4: Domain Operations

#### Task 4.1: Create operations.ts file

**File:** `src/core/store/operations.ts` (new file)
**Action:** Create new file with error types

#### Task 4.2: Implement initializeStore function signature

```typescript
export interface InitStoreOptions {
    categories?: string[];
}

export const initializeStore = async (
    registry: Registry,
    name: string,
    path: string,
    options?: InitStoreOptions,
): Promise<Result<void, InitStoreError>>
```

#### Task 4.3: Implement store directory creation

```typescript
// Inside initializeStore:
try {
    await mkdir(path, { recursive: true });
} catch (error) {
    return err({ code: 'STORE_CREATE_FAILED', ... });
}
```

#### Task 4.4: Implement root index initialization

```typescript
// Inside initializeStore:
const rootIndex = serializeIndex({
    memories: [],
    subcategories: options?.categories?.map((c) => ({ path: c, memoryCount: 0 })) ?? [],
});
await writeFile(join(path, 'index.yaml'), rootIndex.value, 'utf8');
```

#### Task 4.5: Implement registry update

```typescript
// Inside initializeStore:
const loadResult = await registry.load();
if (!loadResult.ok && loadResult.error.code !== 'REGISTRY_MISSING') {
    return err({ code: 'REGISTRY_UPDATE_FAILED', ... });
}
const current = loadResult.ok ? loadResult.value : {};
if (current[name]) {
    return err({ code: 'STORE_ALREADY_EXISTS', ... });
}
current[name] = { path };
const saveResult = await registry.save(current);
```

---

### Group 5: CLI Updates

#### Task 5.1: Refactor init.ts to use initializeStore

**File:** `src/cli/commands/init/command.ts`
**Changes:**

- Import FilesystemRegistry and initializeStore
- Replace manual directory creation with initializeStore call
- Keep config.yaml creation in CLI layer

#### Task 5.2: Keep config.yaml in CLI layer

**File:** `src/cli/commands/init/command.ts`
**Action:** Ensure config.yaml writing stays in handleInit

#### Task 5.3: Refactor store init to use initializeStore

**File:** `src/cli/commands/store/init/command.ts`
**Changes:**

- Import FilesystemRegistry and initializeStore
- Replace createStoreDirectory/registerStore with initializeStore

#### Task 5.4: Update store add command

**File:** `src/cli/commands/store/add/command.ts`
**Changes:**

- Use FilesystemRegistry instead of direct loadStoreRegistry/saveStoreRegistry

---

### Group 6: MCP Server Updates

#### Task 7.1: Update store tools to use Registry interface

**File:** `src/server/store/tools.ts`
**Changes:**

- Update listStoresFromRegistry to use FilesystemRegistry
- Update createStore if needed

#### Task 7.2: Update other references

**File:** Various
**Action:** Search for loadStoreRegistry, saveStoreRegistry references and update

---

### Group 7: Cleanup

#### Task 6.1: Delete store.ts

**File:** `src/core/store/store.ts`
**Action:** Delete file (functionality superseded by registry.getStore)

#### Task 6.2: Update barrel exports in store/index.ts

**File:** `src/core/store/index.ts`
**Action:** Remove store.ts exports, add operations.ts exports
**Note:** May need to create index.ts if it doesn't exist

#### Task 6.3: Update barrel exports in filesystem/index.ts

**File:** `src/core/storage/filesystem/index.ts`
**Changes:**

- Rename FilesystemStoreStorage export to FilesystemRegistry
- Update import path from store-storage.ts to filesystem-registry.ts

#### Task 6.4: Remove deprecated StoreStorage references

**File:** Various
**Action:** Search and update any remaining StoreStorage references

---

### Group 8: Testing

#### Task 8.1: Update existing registry tests

**File:** `src/core/store/registry.spec.ts`
**Action:** Ensure tests still pass for pure functions

#### Task 8.2: Add tests for FilesystemRegistry.initialize()

**File:** `src/core/storage/filesystem/filesystem-registry.spec.ts` (new)
**Action:** Test initialize creates file, handles existing file

#### Task 8.3: Add tests for FilesystemRegistry.getStore()

**File:** `src/core/storage/filesystem/filesystem-registry.spec.ts`
**Action:** Test getStore returns adapter, handles missing store

#### Task 8.4: Add tests for initializeStore

**File:** `src/core/store/operations.spec.ts` (new)
**Action:** Test store creation, category creation, registry update

#### Task 8.5: Run full test suite

**Action:** Run `bun test` and fix any failures

---

### Group 9: Documentation

#### Task 9.1: Update code comments and JSDoc

**Files:** All modified files
**Action:** Ensure JSDoc is complete and accurate

#### Task 9.2: Update architecture docs if exists

**Action:** Check for architecture docs and update

---

## Dependency Graph

```
Group 1 (Interfaces) ──┬──────────────────────────┐
                       │                          │
                       v                          │
Group 2 (Pure Parsing) ─┬─────────────────────────┤
                        │                         │
                        v                         │
Group 3 (FilesystemRegistry) ─┬───────────────────┤
                              │                   │
              ┌───────────────┼───────────────┐   │
              │               │               │   │
              v               v               v   │
Group 4      Group 5         Group 6              │
(Operations) (CLI)           (MCP)                │
              │               │               │   │
              └───────────────┴───────────────┘   │
                              │                   │
                              v                   │
                        Group 7 (Cleanup) ────────┤
                              │                   │
                              v                   │
                        Group 8 (Testing) ────────┤
                              │                   │
                              v                   │
                        Group 9 (Docs) ───────────┘
```

## Parallelization Opportunities

1. **Groups 4, 5, 6** can all start once Group 3 completes
2. **Task 8.1** (registry pure function tests) can run after Group 2
3. **Documentation** can be done incrementally alongside implementation
