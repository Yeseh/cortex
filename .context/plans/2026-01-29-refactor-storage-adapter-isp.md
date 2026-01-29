# Refactor Storage Adapter (ISP) Implementation Plan

**Goal:** Apply Interface Segregation Principle to split the monolithic `StorageAdapter` into four focused interfaces: `MemoryStorage`, `IndexStorage`, `CategoryStorage`, and `StoreStorage`.

**Architecture:** Refactor `FilesystemStorageAdapter` from a monolithic class into a composition of four focused storage classes. Each class implements a focused interface and receives `FilesystemContext` in its constructor. The adapter exposes these as properties (`adapter.memories`, `adapter.indexes`, `adapter.categories`, `adapter.stores`).

**Tech Stack:** TypeScript, Bun test framework, Result types (no exceptions)

**Session Id:** ses_3f5984d76ffeH24eEdBwgxNYEj

---

## Summary of Changes

### Breaking Changes

- `StorageAdapter` interface now uses composition with four properties instead of methods
- Consumers must update from `adapter.readMemoryFile(path)` to `adapter.memories.read(path)`
- Index updates no longer happen automatically in `memories.write()` - callers must explicitly call index methods

### Files to Modify

1. `src/core/storage/adapter.ts` - Interface definitions
2. `src/core/storage/filesystem/index.ts` - Adapter implementation
3. `src/core/storage/filesystem/memories.ts` - FilesystemMemoryStorage class
4. `src/core/storage/filesystem/indexes.ts` - FilesystemIndexStorage class
5. `src/core/storage/filesystem/categories.ts` - FilesystemCategoryStorage class
6. `src/core/storage/filesystem/stores.ts` - New FilesystemStoreStorage class
7. `src/core/category/types.ts` - No changes needed (already named correctly)
8. All MCP tools, CLI commands, and tests

---

## Phase 1: Define New Interfaces

### Task 1.1: Create MemoryStorage interface in adapter.ts

```typescript
export interface MemoryStorage {
    read(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>>;
    write(slugPath: MemorySlugPath, contents: string): Promise<Result<void, StorageAdapterError>>;
    remove(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>>;
    move(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>>;
}
```

### Task 1.2: Create IndexStorage interface in adapter.ts

```typescript
export interface IndexStorage {
    read(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>>;
    write(name: StorageIndexName, contents: string): Promise<Result<void, StorageAdapterError>>;
    reindex(): Promise<Result<void, StorageAdapterError>>;
    updateAfterMemoryWrite(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { createWhenMissing?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;
}
```

### Task 1.3: Create StoreStorage interface in adapter.ts

```typescript
import type {
    StoreRegistry,
    StoreRegistryLoadError,
    StoreRegistrySaveError,
} from '../store/registry.ts';

export interface StoreStorage {
    load(
        path: string,
        options?: { allowMissing?: boolean }
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>>;
    save(path: string, registry: StoreRegistry): Promise<Result<void, StoreRegistrySaveError>>;
    remove(path: string): Promise<Result<void, StoreRegistrySaveError>>;
}
```

### Task 1.4: Update StorageAdapter interface to use composition

```typescript
export interface StorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
    stores: StoreStorage;
}
```

---

## Phase 2: Implement Filesystem Storage Classes

### Task 2.1: Create FilesystemMemoryStorage class

In `src/core/storage/filesystem/memories.ts`:

- Create class that implements `MemoryStorage`
- Constructor receives `FilesystemContext`
- Methods delegate to existing functions (readMemory, writeMemory, removeMemory, moveMemory)
- Remove index update logic from write (move to business layer)

```typescript
export class FilesystemMemoryStorage implements MemoryStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    async read(slugPath: MemorySlugPath): Promise<Result<string | null, StorageAdapterError>> {
        return readMemory(this.ctx, slugPath);
    }

    async write(
        slugPath: MemorySlugPath,
        contents: string
    ): Promise<Result<void, StorageAdapterError>> {
        return writeMemory(this.ctx, slugPath, contents);
    }

    async remove(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        return removeMemory(this.ctx, slugPath);
    }

    async move(
        source: MemorySlugPath,
        dest: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>> {
        return moveMemory(this.ctx, source, dest);
    }
}
```

### Task 2.2: Create FilesystemIndexStorage class

In `src/core/storage/filesystem/indexes.ts`:

- Create class that implements `IndexStorage`
- Constructor receives `FilesystemContext`
- Expose existing functions through interface methods

```typescript
export class FilesystemIndexStorage implements IndexStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    async read(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>> {
        return readIndexFile(this.ctx, name);
    }

    async write(
        name: StorageIndexName,
        contents: string
    ): Promise<Result<void, StorageAdapterError>> {
        return writeIndexFile(this.ctx, name, contents);
    }

    async reindex(): Promise<Result<void, StorageAdapterError>> {
        return reindexCategoryIndexes(this.ctx);
    }

    async updateAfterMemoryWrite(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { createWhenMissing?: boolean }
    ): Promise<Result<void, StorageAdapterError>> {
        return updateCategoryIndexes(this.ctx, slugPath, contents, options);
    }
}
```

### Task 2.3: Create FilesystemCategoryStorage class

In `src/core/storage/filesystem/categories.ts`:

- Create class that implements `CategoryStorage`
- Constructor receives `FilesystemContext`
- Expose existing functions through interface methods
- Move `readCategoryIndex` helper from indexes.ts if needed

```typescript
export class FilesystemCategoryStorage implements CategoryStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        return categoryExists(this.ctx, path);
    }

    async readCategoryIndex(path: string): Promise<Result<CategoryIndex | null, CategoryError>> {
        return readCategoryIndexForPort(this.ctx, path);
    }

    async writeCategoryIndex(
        path: string,
        index: CategoryIndex
    ): Promise<Result<void, CategoryError>> {
        return writeCategoryIndexForPort(this.ctx, path, index);
    }

    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return ensureCategoryDirectory(this.ctx, path);
    }

    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return deleteCategoryDirectory(this.ctx, path);
    }

    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>> {
        return updateSubcategoryDescription(this.ctx, parentPath, subcategoryPath, description);
    }

    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>> {
        return removeSubcategoryEntry(this.ctx, parentPath, subcategoryPath);
    }
}
```

### Task 2.4: Create FilesystemStoreStorage class

Create new file `src/core/storage/filesystem/stores.ts`:

- Create class that implements `StoreStorage`
- Delegates to existing functions in `src/core/store/registry.ts`

```typescript
import type { Result } from '../../types.ts';
import type { StoreStorage } from '../adapter.ts';
import type {
    StoreRegistry,
    StoreRegistryLoadError,
    StoreRegistrySaveError,
} from '../../store/registry.ts';
import { loadStoreRegistry, saveStoreRegistry, removeStoreRegistry } from '../../store/registry.ts';

export class FilesystemStoreStorage implements StoreStorage {
    async load(
        path: string,
        options?: { allowMissing?: boolean }
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>> {
        return loadStoreRegistry(path, options);
    }

    async save(
        path: string,
        registry: StoreRegistry
    ): Promise<Result<void, StoreRegistrySaveError>> {
        return saveStoreRegistry(path, registry);
    }

    async remove(path: string): Promise<Result<void, StoreRegistrySaveError>> {
        return removeStoreRegistry(path);
    }
}
```

---

## Phase 3: Refactor FilesystemStorageAdapter

### Task 3.1: Update FilesystemStorageAdapter to compose storage classes

```typescript
export class FilesystemStorageAdapter implements StorageAdapter {
    readonly memories: FilesystemMemoryStorage;
    readonly indexes: FilesystemIndexStorage;
    readonly categories: FilesystemCategoryStorage;
    readonly stores: FilesystemStoreStorage;

    constructor(options: FilesystemStorageAdapterOptions) {
        const ctx: FilesystemContext = {
            storeRoot: resolve(options.rootDirectory),
            memoryExtension: normalizeExtension(options.memoryExtension, '.md'),
            indexExtension: normalizeExtension(options.indexExtension, '.yaml'),
        };

        this.memories = new FilesystemMemoryStorage(ctx);
        this.indexes = new FilesystemIndexStorage(ctx);
        this.categories = new FilesystemCategoryStorage(ctx);
        this.stores = new FilesystemStoreStorage();
    }
}
```

### Task 3.2: Keep backward-compatible methods (deprecated)

For a smoother migration, keep the old methods as deprecated wrappers during transition:

```typescript
// DEPRECATED - use adapter.memories.read()
async readMemoryFile(slugPath: MemorySlugPath): Promise<StringOrNullResult> {
    return this.memories.read(slugPath);
}
// ... similar for other methods
```

---

## Phase 4: Update Consumers

### Task 4.1: Update MCP memory tools (src/server/memory/tools.ts)

Change:

- `adapter.readMemoryFile(path)` -> `adapter.memories.read(path)`
- `adapter.writeMemoryFile(path, content, options)` -> `adapter.memories.write(path, content)` followed by `adapter.indexes.updateAfterMemoryWrite(path, content, options)` when needed
- `adapter.removeMemoryFile(path)` -> `adapter.memories.remove(path)`
- `adapter.moveMemoryFile(src, dest)` -> `adapter.memories.move(src, dest)`
- `adapter.readIndexFile(name)` -> `adapter.indexes.read(name)`
- `adapter.reindexCategoryIndexes()` -> `adapter.indexes.reindex()`

### Task 4.2: Update MCP category tools (src/server/category/tools.ts)

Update the `createCategoryStoragePort` function to use the new pattern:

```typescript
const createCategoryStoragePort = (storeRoot: string): CategoryStorage => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    return adapter.categories; // Direct return since it now implements CategoryStorage
};
```

### Task 4.3: Update CLI commands

Commands to update (all in src/cli/commands/):

- add.ts
- list.ts
- move.ts
- prune.ts
- reindex.ts
- remove.ts
- update.ts

For each, update adapter method calls to use the new composition pattern.

### Task 4.4: Update MCP memory resources (src/server/memory/resources.ts)

Similar pattern updates for resource handlers.

---

## Phase 5: Update Tests

### Task 5.1: Update filesystem/index.spec.ts

Update all tests to use new method patterns:

- `adapter.readMemoryFile()` -> `adapter.memories.read()`
- `adapter.writeMemoryFile()` -> `adapter.memories.write()` + `adapter.indexes.updateAfterMemoryWrite()`
- etc.

### Task 5.2: Update filesystem/memories.spec.ts

Tests should still work since they test the underlying functions directly, not the adapter.

### Task 5.3: Add tests for new classes

Add unit tests for:

- FilesystemMemoryStorage
- FilesystemIndexStorage
- FilesystemCategoryStorage
- FilesystemStoreStorage

### Task 5.4: Update integration tests

Update any integration tests in:

- src/server/memory/tools.spec.ts
- src/server/category/validation.spec.ts
- src/server/memory/resources.spec.ts
- src/cli/commands/\*.spec.ts

---

## Phase 6: Cleanup and Documentation

### Task 6.1: Remove deprecated methods

After all consumers are updated, remove the deprecated backward-compatible methods from FilesystemStorageAdapter.

### Task 6.2: Update JSDoc comments

Ensure all new interfaces and classes have comprehensive JSDoc documentation.

### Task 6.3: Update module exports

Update `src/core/storage/filesystem/index.ts` to export new classes.

---

## Dependency Map

```
Phase 1 (Interfaces) - No dependencies
    |
    v
Phase 2 (Classes) - Depends on Phase 1
    |
    v
Phase 3 (Adapter Refactor) - Depends on Phase 2
    |
    v
Phase 4 (Update Consumers) - Depends on Phase 3
    |
    v
Phase 5 (Update Tests) - Depends on Phase 3, can run in parallel with Phase 4
    |
    v
Phase 6 (Cleanup) - Depends on Phases 4 and 5
```

## Parallelization Opportunities

1. Tasks 2.1-2.4 can be done in parallel after Phase 1 is complete
2. Tasks 4.1-4.4 can be done in parallel after Phase 3 is complete
3. Task 5.1-5.4 can be done in parallel after Phase 3 is complete

## Testing Strategy

After each phase:

1. Run `bun test` to ensure existing tests pass
2. Run `bun typecheck` to ensure type safety
3. Run `bun lint` to ensure code quality

## Rollback Plan

If issues arise, revert the PR. No data migration is needed since the storage format is unchanged.
