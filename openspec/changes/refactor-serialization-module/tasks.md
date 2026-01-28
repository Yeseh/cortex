# Tasks

## 1. Create expanded serialization module

- [x] 1.1 Create `src/core/serialization.ts` (kept `serialize.ts` for backwards compat, will delete in cleanup)
- [x] 1.2 Add `deserialize<T>(raw: string, format: OutputFormat): T` function
- [x] 1.3 Add Result-typed wrappers: `parseYaml<T>(raw)`, `stringifyYaml(obj)`
- [x] 1.4 Add Result-typed wrappers: `parseJson<T>(raw)`, `stringifyJson(obj)`
- [x] 1.5 Add `SerializationError` type with code, message, cause
- [x] 1.6 Add comprehensive JSDoc documentation
- [x] 1.7 Create `src/core/serialization.spec.ts` with tests for all functions
- [x] 1.8 Export from `src/core/index.ts` barrel

## 2. Create YAML-based index serialization

- [x] 2.1 Add `serializeIndex(index: CategoryIndex): Result<string, SerializationError>` to serialization module
- [x] 2.2 Add `parseIndex(raw: string): Result<CategoryIndex, SerializationError>` to serialization module
- [x] 2.3 Add Zod schema for CategoryIndex validation during parsing
- [x] 2.4 Write tests verifying round-trip equivalence with existing parser
- [x] 2.5 Verify new YAML output is semantically equivalent to old format

## 3. Update filesystem adapter

- [x] 3.1 Update `src/core/storage/filesystem/` imports to use new serialization
- [x] 3.2 Replace `parseCategoryIndex` calls with `parseIndex`
- [x] 3.3 Replace `serializeCategoryIndex` calls with `serializeIndex`
- [ ] 3.4 Move frontmatter parsing/serialization to `storage/filesystem/formats/` (DEFERRED: requires architectural changes)
- [x] 3.5 Run filesystem adapter tests to verify behavior unchanged

## 4. Update CLI commands

- [x] 4.1 Update `src/cli/commands/store.ts` imports (uses serialization.ts)
- [x] 4.2 Update `src/cli/commands/prune.ts` imports (uses serialization.ts)
- [x] 4.3 Update `src/cli/commands/list.ts` imports (uses serialization.ts)
- [x] 4.4 Update `src/cli/commands/init.ts` imports (uses serialization.ts)
- [ ] 4.5 Update `src/cli/commands/add.ts` imports (DEFERRED: depends on frontmatter relocation)
- [ ] 4.6 Update `src/cli/commands/update.ts` imports (DEFERRED: depends on frontmatter relocation)
- [ ] 4.7 Update `src/cli/commands/show.ts` imports (DEFERRED: depends on frontmatter relocation)
- [x] 4.8 Run CLI command tests to verify behavior unchanged

## 5. Update MCP server

- [x] 5.1 Update `src/server/memory/resources.ts` imports (uses serialization.ts)
- [x] 5.2 Update `src/server/memory/tools.ts` imports (uses serialization.ts)
- [x] 5.3 Run MCP server tests to verify behavior unchanged

## 6. Delete old modules

- [x] 6.1 Delete `src/core/index/parser.ts`
- [x] 6.2 Delete `src/core/index/parser.spec.ts`
- [x] 6.3 Update `src/core/index/index.ts` to remove parser exports
- [ ] 6.4 Move `src/core/memory/formats/frontmatter.ts` to `src/core/storage/filesystem/formats/` (DEFERRED)
- [ ] 6.5 Move `src/core/memory/formats/frontmatter.spec.ts` accordingly (DEFERRED)
- [ ] 6.6 Delete `src/core/memory/formats/index.ts` (DEFERRED)
- [ ] 6.7 Remove `src/core/memory/formats/` directory (DEFERRED)
- [ ] 6.8 Update `src/core/memory/index.ts` to remove format exports (DEFERRED)
- [x] 6.9 Delete `src/core/serialize.ts` (old file, functionality in serialization.ts)
- [x] 6.10 Update `src/core/index.ts` to export from serialization.ts instead of serialize.ts

## 7. Update test fixtures

- [x] 7.1 Update `tests/cli.integration.spec.ts` imports if needed (no changes needed)
- [x] 7.2 Update any test helpers that use old serialization
- [x] 7.3 Run full test suite: `bun test` (708 tests pass)
- [x] 7.4 Run typecheck: `bunx tsc --noEmit` (passes)

## 8. Final cleanup

- [x] 8.1 Remove unused imports across codebase
- [x] 8.2 Update any remaining references to old function names
- [x] 8.3 Verify no dead code remains
- [x] 8.4 Run linter: `bun run lint` (0 errors, warnings acceptable)

## 9. Test isolation fix (added during implementation)

- [x] 9.1 Refactored `src/core/store/store.spec.ts` from mock.module to real temp directories
- [x] 9.2 Fixed test pollution causing category tests to fail intermittently
- [x] 9.3 Updated category test files to use mkdtemp for reliable temp directory creation

---

## Notes

### Deferred Tasks

Tasks 3.4, 4.5-4.7, and 6.4-6.8 have been deferred because:

1. **Frontmatter relocation** (3.4, 6.4-6.8): Moving frontmatter parsing from `core/memory/formats/` to `storage/filesystem/formats/` requires changes to the storage adapter interface. Currently, CLI commands and MCP server directly call `parseMemoryFile`/`serializeMemoryFile`. This needs a separate proposal to:
    - Decide if the storage adapter should return parsed memory objects vs raw strings
    - Update the StorageAdapter interface if needed
    - Handle the architectural coupling between CLI/server and frontmatter parsing

2. **CLI command import updates** (4.5-4.7): These depend on the frontmatter relocation. Once frontmatter is moved to the filesystem adapter, these CLI commands can be updated to not depend on `core/memory/formats`.

### Completed Goals

The primary goals of this proposal have been achieved:

- ✅ Created unified `serialization.ts` module with both serialize and deserialize
- ✅ Added Result-typed wrappers for YAML/JSON parsing
- ✅ Replaced custom index parser with YAML library + Zod validation
- ✅ Deleted `src/core/index/parser.ts` (575 lines removed)
- ✅ Deleted `src/core/serialize.ts` (40 lines removed)
- ✅ All tests pass (708/708)
- ✅ TypeScript compilation successful
