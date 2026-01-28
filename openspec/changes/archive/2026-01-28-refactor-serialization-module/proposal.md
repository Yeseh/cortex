# Change: Refactor serialization module with deserialization support

## Why

The codebase has fragmented serialization/deserialization logic:

1. **`src/core/memory/formats/frontmatter.ts`** (441 lines) - Custom YAML frontmatter parsing in the wrong location (memory domain instead of storage layer)
2. **`src/core/index/parser.ts`** (575 lines) - Hand-rolled YAML-like parsing when `yaml` library is available
3. **`src/core/serialize.ts`** (41 lines) - Only handles serialization, not deserialization

This creates:

- Maintenance burden from custom parsing code
- Inconsistent error handling across parsers
- Wrong module boundaries (format concerns in domain modules)

## What Changes

### 1. Expand serialization module

- **BREAKING**: Rename `src/core/serialize.ts` → `src/core/serialization.ts`
- Add `deserialize(raw, format)` function using `yaml` library and `JSON.parse`
- Add typed wrappers: `parseYaml<T>()`, `stringifyYaml()` with Result types
- Export both serialize and deserialize from core barrel

### 2. Replace custom index parser

- **BREAKING**: Delete `src/core/index/parser.ts` (575 lines)
- Replace `parseCategoryIndex` / `serializeCategoryIndex` with generic YAML serialization
- Index format will use standard YAML library output (slightly different whitespace, equivalent semantics)
- Move index types to remain in `src/core/index/types.ts`

### 3. Remove frontmatter format from memory module

- **BREAKING**: Delete `src/core/memory/formats/` directory entirely
- **BREAKING**: Remove `parseFrontmatter`, `serializeFrontmatter` exports from `core/memory`
- **BREAKING**: Remove deprecated `parseMemoryFile`, `serializeMemoryFile` exports
- Frontmatter parsing moves to filesystem storage adapter (separate proposal)

### 4. Update consumers

- CLI commands import serialization from `core/serialization`
- MCP server imports serialization from `core/serialization`
- Filesystem adapter handles frontmatter internally (after filesystem split proposal)

## Impact

- Affected specs: `memory-core`, `storage-filesystem`, `index`
- Affected code:
    - `src/core/serialize.ts` → `src/core/serialization.ts` (expand)
    - `src/core/index/parser.ts` → Delete
    - `src/core/memory/formats/` → Delete entire directory
    - `src/core/memory/index.ts` → Remove format exports
    - `src/core/storage/filesystem.ts` → Use new serialization, inline frontmatter
    - `src/cli/commands/*.ts` → Update imports
    - `src/server/memory/*.ts` → Update imports
    - All tests referencing deleted functions

## Dependencies

- This change should be completed BEFORE `refactor-filesystem-storage` (separate proposal)
- The filesystem adapter will temporarily inline frontmatter logic until split
- Supersedes parts of `refactor-output-serialization` (can be archived/merged)

## Migration Path

1. Create `serialization.ts` with both serialize and deserialize
2. Add YAML-based index serialization alongside existing parser
3. Update all consumers to use new serialization module
4. Delete old parser and frontmatter modules
5. Run full test suite to verify equivalence
