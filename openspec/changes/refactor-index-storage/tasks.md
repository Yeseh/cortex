## 1. Core Interface Changes

- [x] 1.1 Update `IndexStorage` interface: `read()` returns `CategoryIndex | null`, `write()` accepts `CategoryIndex`
- [x] 1.2 Remove `readCategoryIndex()` and `writeCategoryIndex()` from `CategoryStorage` interface
- [x] 1.3 Rename `CategoryStorage` methods: `categoryExists` → `exists`, `ensureCategoryDirectory` → `ensure`, `deleteCategoryDirectory` → `delete`

## 2. Move Serialization

- [x] 2.1 Move `parseIndex()` / `serializeIndex()` from `core/serialization.ts` into `storage-fs` as internal helpers
- [x] 2.2 Remove index parsing/serialization exports from core

## 3. Storage-FS Implementation

- [x] 3.1 Update `FilesystemIndexStorage` to parse/serialize YAML internally, returning structured `CategoryIndex`
- [x] 3.2 Update `FilesystemCategoryStorage` to remove index methods and rename directory methods

## 4. Update Consumers

- [x] 4.1 Update core `memory/operations.ts` — remove `readCategoryIndex` helper, use `indexes.read()` directly
- [x] 4.2 Update core `category/operations.ts` — use new method names
- [x] 4.3 Update CLI commands that call CategoryStorage or IndexStorage
- [x] 4.4 Update MCP server handlers that call CategoryStorage or IndexStorage

## 5. Tests

- [x] 5.1 Update core operation tests for new interfaces
- [x] 5.2 Update storage-fs tests for structured IndexStorage
- [x] 5.3 Update CLI and server tests
- [x] 5.4 Ensure all tests pass
