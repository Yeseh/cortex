# Plan: Align storage-fs with core

## Summary

The storage-fs module has fallen out of sync with the core module after refactors. This plan aligns the two by:

- Fixing core exports and package.json paths
- Renaming methods in storage-fs to match core interfaces
- Creating new adapter implementations (`FilesystemStoreAdapter`, `FilesystemConfigAdapter`)
- Removing the incomplete `FilesystemRegistry` abstraction

| Category         | Count            |
| ---------------- | ---------------- |
| Files to modify  | 9                |
| Files to create  | 4                |
| Files to delete  | 2                |
| Breaking changes | Yes (sanctioned) |

---

## Architecture Overview

```
FilesystemConfigAdapter (top-level, global)
    └── Reads/writes single config.yaml file
    └── Methods: initialize(), getSettings(), getStores(), getStore()

FilesystemStorageAdapter (per-store, scoped to store root)
    ├── memories: FilesystemMemoryStorage
    ├── indexes: FilesystemIndexStorage
    ├── categories: FilesystemCategoryStorage
    └── stores: FilesystemStoreAdapter (operates on store.yaml in store root)
```

- `ConfigAdapter` handles global config at `~/.config/cortex/config.yaml`
- `StoreAdapter` handles the `store.yaml` file within each store's root directory

---

## Phase 1: Fix Core Module Issues

### 1.1 Fix package.json export path

**File:** `packages/core/package.json:31-34`

```diff
 "./storage": {
-  "import": "./src/storage/adapter.ts",
-  "types": "./src/storage/adapter.ts"
+  "import": "./src/storage/index.ts",
+  "types": "./src/storage/index.ts"
 }
```

### 1.2 Add type aliases and update StorageAdapter

**File:** `packages/core/src/storage/index.ts`

- Add type aliases:
    ```typescript
    export type MemoryStorage = MemoryAdapter;
    export type IndexStorage = IndexAdapter;
    export type CategoryStorage = CategoryAdapter;
    ```
- Remove `config: ConfigAdapter` from `StorageAdapter` interface (it's now top-level)

### 1.3 Export CategoryMemoryEntry

**File:** `packages/core/src/category/index.ts`

- Add `CategoryMemoryEntry` to the type exports

### 1.4 Remove unused imports

**File:** `packages/core/src/storage/store-adapter.ts`

- Remove unused `ConfigStore` and `StorageAdapterResult` imports

---

## Phase 2: Align Existing Storage-FS Implementations

### 2.1 FilesystemMemoryStorage

**File:** `packages/storage-fs/src/memory-storage.ts`

| Change           | Details                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| Rename method    | `read()` → `load()`                                                    |
| Change signature | `write(memory: Memory)` → `save(path: MemoryPath, memory: MemoryData)` |
| Add method       | `add(memory: Memory)` - fails if memory already exists                 |
| Update type      | `implements MemoryStorage` → `implements MemoryAdapter`                |

### 2.2 FilesystemIndexStorage

**File:** `packages/storage-fs/src/index-storage.ts`

| Change        | Details                         |
| ------------- | ------------------------------- |
| Rename method | `read()` → `load()`             |
| Delete method | `readIndexFile()` (deprecated)  |
| Delete method | `writeIndexFile()` (deprecated) |

### 2.3 FilesystemCategoryStorage

**File:** `packages/storage-fs/src/category-storage.ts`

| Change        | Details                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| Rename method | `updateSubcategoryDescription()` → `setDescription()`                        |
| Fix import    | Replace `../../core/src/category/category-path.ts` with `@yeseh/cortex-core` |

---

## Phase 3: Create New Adapter Implementations

### 3.1 Create FilesystemStoreAdapter

**New file:** `packages/storage-fs/src/store-storage.ts`

```typescript
export class FilesystemStoreAdapter implements StoreAdapter {
    constructor(private readonly ctx: FilesystemContext) {}

    // Reads {storeRoot}/store.yaml
    async load(name: StoreName): Promise<StoreResult<Store | null>>;

    // Writes {storeRoot}/store.yaml
    async save(name: StoreName, store: StoreData): Promise<StoreResult<void>>;

    // Deletes {storeRoot}/store.yaml
    async remove(name: StoreName): Promise<StoreResult<void>>;
}
```

### 3.2 Create FilesystemConfigAdapter

**New file:** `packages/storage-fs/src/config-storage.ts`

```typescript
// Top-level class, NOT composed into StorageAdapter
export class FilesystemConfigAdapter implements ConfigAdapter {
    constructor(private readonly configPath: string) {}

    // Creates default config if missing
    async initialize(): Promise<ConfigResult<void>>;

    // Reads settings section from config
    async getSettings(): Promise<ConfigResult<CortexSettings>>;

    // Reads stores section from config
    async getStores(): Promise<ConfigResult<ConfigStores>>;

    // Gets specific store config by name
    async getStore(storeName: string): Promise<ConfigResult<ConfigStore | null>>;
}
```

### 3.3 Create test files

**New files:**

- `packages/storage-fs/src/store-storage.spec.ts`
- `packages/storage-fs/src/config-storage.spec.ts`

---

## Phase 4: Update FilesystemStorageAdapter

**File:** `packages/storage-fs/src/index.ts`

| Change             | Details                                                     |
| ------------------ | ----------------------------------------------------------- |
| Add property       | `stores: FilesystemStoreAdapter`                            |
| Update constructor | Initialize `FilesystemStoreAdapter`                         |
| Remove import      | `MemoryStorage`, `IndexStorage` (use `MemoryAdapter`, etc.) |
| Remove export      | `FilesystemRegistry`                                        |
| Add exports        | `FilesystemStoreAdapter`, `FilesystemConfigAdapter`         |

---

## Phase 5: Delete Registry Files

| File                                                  | Action     |
| ----------------------------------------------------- | ---------- |
| `packages/storage-fs/src/filesystem-registry.ts`      | **Delete** |
| `packages/storage-fs/src/filesystem-registry.spec.ts` | **Delete** |

---

## Phase 6: Fix Remaining Type Issues

### 6.1 Remove `summary` property handling

**File:** `packages/storage-fs/src/index-serialization.ts:110`

- Remove references to `entry.summary` (doesn't exist in `CategoryMemoryEntry`)

### 6.2 Fix relative imports

**File:** `packages/storage-fs/src/categories.spec.ts:14`

- Change `../../core/src/category/category-path.ts` to `@yeseh/cortex-core`

---

## Phase 7: Update Existing Tests

### 7.1 memory-storage.spec.ts

- Rename calls: `read()` → `load()`, `write()` → `save()`
- Update `save()` call signatures
- Add tests for `add()` method

### 7.2 index-storage.spec.ts

- Rename calls: `read()` → `load()`
- Remove tests for deprecated methods

### 7.3 category-storage.spec.ts

- Rename calls: `updateSubcategoryDescription()` → `setDescription()`

---

## File Change Summary

| File                                                  | Action     |
| ----------------------------------------------------- | ---------- |
| `packages/core/package.json`                          | Modify     |
| `packages/core/src/storage/index.ts`                  | Modify     |
| `packages/core/src/storage/store-adapter.ts`          | Modify     |
| `packages/core/src/category/index.ts`                 | Modify     |
| `packages/storage-fs/src/index.ts`                    | Modify     |
| `packages/storage-fs/src/memory-storage.ts`           | Modify     |
| `packages/storage-fs/src/index-storage.ts`            | Modify     |
| `packages/storage-fs/src/category-storage.ts`         | Modify     |
| `packages/storage-fs/src/index-serialization.ts`      | Modify     |
| `packages/storage-fs/src/store-storage.ts`            | **Create** |
| `packages/storage-fs/src/store-storage.spec.ts`       | **Create** |
| `packages/storage-fs/src/config-storage.ts`           | **Create** |
| `packages/storage-fs/src/config-storage.spec.ts`      | **Create** |
| `packages/storage-fs/src/filesystem-registry.ts`      | **Delete** |
| `packages/storage-fs/src/filesystem-registry.spec.ts` | **Delete** |
| `packages/storage-fs/src/memory-storage.spec.ts`      | Modify     |
| `packages/storage-fs/src/index-storage.spec.ts`       | Modify     |
| `packages/storage-fs/src/category-storage.spec.ts`    | Modify     |
| `packages/storage-fs/src/categories.spec.ts`          | Modify     |

---

## Execution Order

1. **Phase 1** (Core fixes) - Must come first as storage-fs depends on core
2. **Phase 5** (Delete registry) - Remove early to avoid confusion
3. **Phase 2** (Align existing implementations)
4. **Phase 3** (Create new adapters)
5. **Phase 4** (Update main adapter)
6. **Phase 6** (Fix type issues)
7. **Phase 7** (Update tests)
8. **Verification** - Run `bun run typecheck` and `bun test packages/storage-fs`

---

## Interface Reference

### Core Interfaces (source of truth)

**MemoryAdapter** (`packages/core/src/storage/memory-adapter.ts`):

```typescript
interface MemoryAdapter {
    load(path: MemoryPath): Promise<Result<Memory | null, StorageAdapterError>>;
    save(path: MemoryPath, memory: MemoryData): Promise<Result<void, StorageAdapterError>>;
    add(memory: Memory): Promise<Result<void, StorageAdapterError>>;
    remove(path: MemoryPath): Promise<Result<void, StorageAdapterError>>;
    move(
        sourcePath: MemoryPath,
        destinationPath: MemoryPath
    ): Promise<Result<void, StorageAdapterError>>;
}
```

**IndexAdapter** (`packages/core/src/storage/index-adapter.ts`):

```typescript
interface IndexAdapter {
    load(category: CategoryPath): Promise<Result<Category | null, StorageAdapterError>>;
    write(path: CategoryPath, contents: Category): Promise<Result<void, StorageAdapterError>>;
    reindex(scope: CategoryPath): Promise<Result<ReindexResult, StorageAdapterError>>;
    updateAfterMemoryWrite(
        memory: Memory,
        options?: { createWhenMissing?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;
}
```

**CategoryAdapter** (`packages/core/src/storage/category-adapter.ts`):

```typescript
interface CategoryAdapter {
    exists(path: CategoryPath): Promise<CategoryResult<boolean>>;
    ensure(path: CategoryPath): Promise<CategoryResult<void>>;
    delete(path: CategoryPath): Promise<CategoryResult<void>>;
    setDescription(
        categoryPath: CategoryPath,
        description: string | null
    ): Promise<CategoryResult<void>>;
}
```

**StoreAdapter** (`packages/core/src/storage/store-adapter.ts`):

```typescript
interface StoreAdapter {
    load(name: StoreName): Promise<StoreResult<Store | null>>;
    save(name: StoreName, store: StoreData): Promise<StoreResult<void>>;
    remove(name: StoreName): Promise<StoreResult<void>>;
}
```

**ConfigAdapter** (`packages/core/src/storage/config-adapter.ts`):

```typescript
interface ConfigAdapter {
    initialize(): Promise<ConfigResult<void>>;
    getSettings(): Promise<ConfigResult<CortexSettings>>;
    getStores(): Promise<ConfigResult<ConfigStores>>;
    getStore(storeName: string): Promise<ConfigResult<ConfigStore | null>>;
}
```

**StorageAdapter** (`packages/core/src/storage/index.ts`):

```typescript
interface StorageAdapter {
    memories: MemoryAdapter;
    indexes: IndexAdapter;
    categories: CategoryAdapter;
    stores: StoreAdapter;
    // Note: config is NOT included - it's a separate top-level adapter
}
```
