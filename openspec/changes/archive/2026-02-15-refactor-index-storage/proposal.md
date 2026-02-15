# Change: Refactor IndexStorage to structured data and clean up CategoryStorage

## Why

The `IndexStorage` interface currently returns raw strings, leaking YAML serialization details through the port boundary. Core operations always want structured `CategoryIndex` data — the string layer is an artifact of the filesystem backend. Additionally, `CategoryStorage` has overlapping index methods and filesystem-leaking names.

## What Changes

- `IndexStorage.read()` returns `CategoryIndex | null` instead of `string | null`
- `IndexStorage.write()` accepts `CategoryIndex` instead of `string`
- `parseIndex()` / `serializeIndex()` move from core's `serialization.ts` into `storage-fs` as internal implementation details
- `CategoryStorage.readCategoryIndex()` and `writeCategoryIndex()` merge into `IndexStorage`
- `CategoryStorage` methods renamed: `categoryExists` → `exists`, `ensureCategoryDirectory` → `ensure`, `deleteCategoryDirectory` → `delete`
- **BREAKING** interface changes across core, storage-fs, CLI, and server

## Impact

- Affected specs: `index`, `storage-filesystem`, `category-core`
- Affected code: `packages/core/src/storage/adapter.ts`, `packages/core/src/category/types.ts`, `packages/core/src/memory/operations.ts`, `packages/core/src/category/operations.ts`, `packages/core/src/serialization.ts`, `packages/storage-fs/src/index-storage.ts`, `packages/storage-fs/src/category-storage.ts`, CLI and server consumers
