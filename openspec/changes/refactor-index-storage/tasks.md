## 1. Core Interface Changes

- [ ] 1.1 Update `IndexStorage` interface: `read()` returns `CategoryIndex | null`, `write()` accepts `CategoryIndex`
- [ ] 1.2 Remove `readCategoryIndex()` and `writeCategoryIndex()` from `CategoryStorage` interface
- [ ] 1.3 Rename `CategoryStorage` methods: `categoryExists` → `exists`, `ensureCategoryDirectory` → `ensure`, `deleteCategoryDirectory` → `delete`

## 2. Move Serialization

- [ ] 2.1 Move `parseIndex()` / `serializeIndex()` from `core/serialization.ts` into `storage-fs` as internal helpers
- [ ] 2.2 Remove index parsing/serialization exports from core

## 3. Storage-FS Implementation

- [ ] 3.1 Update `FilesystemIndexStorage` to parse/serialize YAML internally, returning structured `CategoryIndex`
- [ ] 3.2 Update `FilesystemCategoryStorage` to remove index methods and rename directory methods

## 4. Update Consumers

- [ ] 4.1 Update core `memory/operations.ts` — remove `readCategoryIndex` helper, use `indexes.read()` directly
- [ ] 4.2 Update core `category/operations.ts` — use new method names
- [ ] 4.3 Update CLI commands that call CategoryStorage or IndexStorage
- [ ] 4.4 Update MCP server handlers that call CategoryStorage or IndexStorage

## 5. Tests

- [ ] 5.1 Update core operation tests for new interfaces
- [ ] 5.2 Update storage-fs tests for structured IndexStorage
- [ ] 5.3 Update CLI and server tests
- [ ] 5.4 Ensure all tests pass
