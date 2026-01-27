# Change: Refactor memory module for storage-agnostic domain types

## Why

The current `src/core/memory/` module has several architectural issues:

1. **Naming leaks implementation**: Types like `MemoryFile`, `MemoryFileFrontmatter`, `parseMemoryFile` imply file-based storage, coupling the domain model to a specific backend
2. **Missing module structure**: No `index.ts` barrel export, no separation between domain types and format-specific serialization
3. **Inconsistent with project standards**: Uses local `ok`/`err` helpers, uses `interface` for data structures, missing JSDoc documentation
4. **Duplicate/conflicting types**: `MemoryMetadata` exists in both `core/types.ts` (incomplete) and `memory/file.ts` (as `MemoryFileFrontmatter`)

This refactoring aligns the memory module with the established patterns from `src/core/category/` and enables future storage backends without domain type changes.

## What Changes

- **BREAKING**: Rename `MemoryFileFrontmatter` → `MemoryMetadata`, `MemoryFileContents` → `Memory`
- **BREAKING**: Rename `parseMemoryFile` → `parseFrontmatter`, `serializeMemoryFile` → `serializeFrontmatter`
- **BREAKING**: Move format-specific code to `formats/frontmatter.ts`
- Create `types.ts` with storage-agnostic domain types using `type` (not `interface`)
- Create `index.ts` barrel export
- Remove incomplete `MemoryMetadata` from `core/types.ts`
- Import `ok`/`err` from `core/result.ts` instead of local definitions
- Add comprehensive JSDoc documentation
- Split `memory.spec.ts` into `validation.spec.ts` and `formats/frontmatter.spec.ts`

## Impact

- Affected specs: `memory-core`
- Affected code:
    - `src/core/memory/file.ts` → Split into `types.ts` + `formats/frontmatter.ts`
    - `src/core/memory/validation.ts` → Update imports
    - `src/core/memory/memory.spec.ts` → Split into separate test files
    - `src/core/types.ts` → Remove `MemoryMetadata`
    - `src/core/memory/index.ts` → New barrel export
    - Consumers of `parseMemoryFile`/`serializeMemoryFile` need import updates
