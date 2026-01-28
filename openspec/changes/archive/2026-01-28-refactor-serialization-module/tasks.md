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
- [x] 3.4 Run filesystem adapter tests to verify behavior unchanged

## 4. Update CLI commands

- [x] 4.1 Update `src/cli/commands/store.ts` imports (uses serialization.ts)
- [x] 4.2 Update `src/cli/commands/prune.ts` imports (uses serialization.ts)
- [x] 4.3 Update `src/cli/commands/list.ts` imports (uses serialization.ts)
- [x] 4.4 Update `src/cli/commands/init.ts` imports (uses serialization.ts)
- [x] 4.5 Run CLI command tests to verify behavior unchanged

## 5. Update MCP server

- [x] 5.1 Update `src/server/memory/resources.ts` imports (uses serialization.ts)
- [x] 5.2 Update `src/server/memory/tools.ts` imports (uses serialization.ts)
- [x] 5.3 Run MCP server tests to verify behavior unchanged

## 6. Delete old modules

- [x] 6.1 Delete `src/core/index/parser.ts`
- [x] 6.2 Delete `src/core/index/parser.spec.ts`
- [x] 6.3 Update `src/core/index/index.ts` to remove parser exports
- [x] 6.4 Delete `src/core/serialize.ts` (old file, functionality in serialization.ts)
- [x] 6.5 Update `src/core/index.ts` to export from serialization.ts instead of serialize.ts

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

### Completed Goals

The primary goals of this proposal have been achieved:

- ✅ Created unified `serialization.ts` module with both serialize and deserialize
- ✅ Added Result-typed wrappers for YAML/JSON parsing
- ✅ Replaced custom index parser with YAML library + Zod validation
- ✅ Deleted `src/core/index/parser.ts` (575 lines removed)
- ✅ Deleted `src/core/serialize.ts` (40 lines removed)
- ✅ All tests pass (708/708)
- ✅ TypeScript compilation successful

### Out of Scope

Frontmatter relocation from `core/memory/formats/` to `storage/filesystem/formats/` was determined to require architectural changes to the storage adapter interface. This will be addressed in a separate proposal.
