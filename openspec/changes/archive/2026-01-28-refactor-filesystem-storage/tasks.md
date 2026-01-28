# Tasks

## 1. Create module structure

- [x] 1.1 Create `src/core/storage/filesystem/` directory
- [x] 1.2 Create `src/core/storage/filesystem/types.ts` with filesystem-specific types
- [x] 1.3 Create `src/core/storage/filesystem/index.ts` barrel export
- [x] 1.4 Create `src/core/storage/filesystem/utils.ts` with shared utilities

## 2. Extract memory file operations

- [x] 2.1 Create `src/core/storage/filesystem/files.ts`
- [x] 2.2 Move `readMemoryFile`, `writeMemoryFile`, `removeMemoryFile`, `moveMemoryFile` to files.ts
- [x] 2.3 Move file path resolution helpers to files.ts
- [x] 2.4 Move validation helpers (slug path validation) to files.ts

## 3. Extract index operations

- [x] 3.1 Create `src/core/storage/filesystem/indexes.ts`
- [x] 3.2 Move `readIndexFile`, `writeIndexFile`, `reindexCategoryIndexes` to indexes.ts
- [x] 3.3 Move index path resolution helpers to indexes.ts
- [x] 3.4 Move `readCategoryIndex`, `writeCategoryIndex` helpers to indexes.ts
- [x] 3.5 Move `updateCategoryIndexes`, `upsertMemoryEntry`, `upsertSubcategoryEntry` to indexes.ts

## 4. Extract category operations

- [x] 4.1 Create `src/core/storage/filesystem/categories.ts`
- [x] 4.2 Move `categoryExists`, `ensureCategoryDirectory`, `deleteCategoryDirectory` to categories.ts
- [x] 4.3 Move `updateSubcategoryDescription`, `removeSubcategoryEntry` to categories.ts
- [x] 4.4 Move CategoryStoragePort adapter methods to categories.ts

## 5. Move frontmatter format

DEFERRED - This depends on `refactor-serialization-module` which hasn't been completed yet.
The frontmatter module remains in `core/memory/formats/frontmatter.ts` for now.

## 6. Create facade class

- [x] 6.1 Update `src/core/storage/filesystem/index.ts` with `FilesystemStorageAdapter` facade
- [x] 6.2 Facade composes files, indexes, and categories modules
- [x] 6.3 Facade implements `StorageAdapter` interface
- [x] 6.4 Verify all public methods are accessible through facade

## 7. Update imports

- [x] 7.1 No interface changes needed to `src/core/storage/adapter.ts`
- [x] 7.2 Updated all consumers to import from `core/storage/filesystem/index.ts`
- [x] 7.3 Deleted old `src/core/storage/filesystem.ts` file
- [x] 7.4 Moved `src/core/storage/filesystem.spec.ts` to `src/core/storage/filesystem/index.spec.ts`

## 8. Final verification

- [x] 8.1 Run `bun test` - filesystem tests pass (18/18)
- [x] 8.2 Run `bun tsc --noEmit` - no new type errors (pre-existing errors in unrelated files)
- [x] 8.3 Verify public API unchanged for consumers
