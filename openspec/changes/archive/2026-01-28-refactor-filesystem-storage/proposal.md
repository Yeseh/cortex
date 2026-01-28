# Change: Split filesystem storage adapter into focused modules

## Why

The current `src/core/storage/filesystem.ts` (929 lines) is a monolithic file handling three distinct concerns:

1. **Memory file operations** - read, write, move, remove memory files
2. **Index operations** - read, write, update, reindex category indexes
3. **Category operations** - create, delete, check existence of category directories

This violates single responsibility principle and makes the code harder to maintain, test, and extend. The `src/core/category/` module demonstrates the preferred architecture pattern with separate `types.ts`, `operations.ts`, and `index.ts` files.

## What Changes

### 1. Create nested filesystem module

- Create `src/core/storage/filesystem/` directory structure
- Move and split `filesystem.ts` into focused modules

### 2. Split by concern

```
src/core/storage/filesystem/
├── index.ts           # Barrel export + FilesystemStorageAdapter facade
├── types.ts           # Filesystem-specific types and error codes
├── files.ts           # Memory file operations (read, write, move, remove)
├── indexes.ts         # Index operations (read, write, reindex)
├── categories.ts      # Category directory operations
└── formats/
    └── frontmatter.ts # Memory file frontmatter format (from core/memory)
```

### 3. Create storage port interfaces

- Extract `MemoryStorage` interface for memory file operations
- Extract `IndexStorage` interface for index operations
- Keep `CategoryStorage` interface (already exists in category module)
- `FilesystemStorageAdapter` composes all three

### 4. Move frontmatter format

- Move frontmatter parsing/serialization from `core/memory/formats/` to `storage/filesystem/formats/`
- This is the correct location: frontmatter is a filesystem-specific format

## Impact

- Affected specs: `storage-filesystem`
- Affected code:
    - `src/core/storage/filesystem.ts` → Split into multiple files
    - `src/core/storage/filesystem.spec.ts` → Split into focused test files
    - `src/core/storage/adapter.ts` → May need interface updates
    - Consumers import from `core/storage/filesystem` (same public API)

## Dependencies

- **Depends on:** `refactor-serialization-module` (frontmatter uses serialization)
- The serialization refactor should be completed first so frontmatter can use the new module

## Non-Breaking

- Public API remains the same: `FilesystemStorageAdapter` class with same methods
- Internal reorganization only
- Tests verify behavior equivalence
