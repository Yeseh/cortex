# Tasks

## 1. Create expanded serialization module

- [ ] 1.1 Rename `src/core/serialize.ts` → `src/core/serialization.ts`
- [ ] 1.2 Add `deserialize<T>(raw: string, format: OutputFormat): T` function
- [ ] 1.3 Add Result-typed wrappers: `parseYaml<T>(raw)`, `stringifyYaml(obj)`
- [ ] 1.4 Add Result-typed wrappers: `parseJson<T>(raw)`, `stringifyJson(obj)`
- [ ] 1.5 Add `SerializationError` type with code, message, cause
- [ ] 1.6 Add comprehensive JSDoc documentation
- [ ] 1.7 Create `src/core/serialization.spec.ts` with tests for all functions
- [ ] 1.8 Export from `src/core/index.ts` barrel

## 2. Create YAML-based index serialization

- [ ] 2.1 Add `serializeIndex(index: CategoryIndex): Result<string, SerializationError>` to serialization module
- [ ] 2.2 Add `parseIndex(raw: string): Result<CategoryIndex, SerializationError>` to serialization module
- [ ] 2.3 Add Zod schema for CategoryIndex validation during parsing
- [ ] 2.4 Write tests verifying round-trip equivalence with existing parser
- [ ] 2.5 Verify new YAML output is semantically equivalent to old format

## 3. Update filesystem adapter

- [ ] 3.1 Update `src/core/storage/filesystem.ts` imports to use new serialization
- [ ] 3.2 Replace `parseCategoryIndex` calls with `parseIndex`
- [ ] 3.3 Replace `serializeCategoryIndex` calls with `serializeIndex`
- [ ] 3.4 Inline frontmatter parsing/serialization from `formats/frontmatter.ts` temporarily
- [ ] 3.5 Run filesystem adapter tests to verify behavior unchanged

## 4. Update CLI commands

- [ ] 4.1 Update `src/cli/commands/store.ts` imports
- [ ] 4.2 Update `src/cli/commands/prune.ts` imports
- [ ] 4.3 Update `src/cli/commands/list.ts` imports
- [ ] 4.4 Update `src/cli/commands/init.ts` imports
- [ ] 4.5 Update `src/cli/commands/add.ts` imports (frontmatter)
- [ ] 4.6 Update `src/cli/commands/update.ts` imports (frontmatter)
- [ ] 4.7 Update `src/cli/commands/show.ts` imports (frontmatter)
- [ ] 4.8 Run CLI command tests to verify behavior unchanged

## 5. Update MCP server

- [ ] 5.1 Update `src/server/memory/resources.ts` imports
- [ ] 5.2 Update `src/server/memory/tools.ts` imports
- [ ] 5.3 Run MCP server tests to verify behavior unchanged

## 6. Delete old modules

- [ ] 6.1 Delete `src/core/index/parser.ts`
- [ ] 6.2 Delete `src/core/index/parser.spec.ts`
- [ ] 6.3 Update `src/core/index/index.ts` to remove parser exports
- [ ] 6.4 Delete `src/core/memory/formats/frontmatter.ts`
- [ ] 6.5 Delete `src/core/memory/formats/frontmatter.spec.ts`
- [ ] 6.6 Delete `src/core/memory/formats/index.ts`
- [ ] 6.7 Remove `src/core/memory/formats/` directory
- [ ] 6.8 Update `src/core/memory/index.ts` to remove format exports

## 7. Update test fixtures

- [ ] 7.1 Update `tests/cli.integration.spec.ts` imports
- [ ] 7.2 Update any test helpers that use old serialization
- [ ] 7.3 Run full test suite: `bun test`
- [ ] 7.4 Run typecheck: `bun run typecheck`

## 8. Final cleanup

- [ ] 8.1 Remove unused imports across codebase
- [ ] 8.2 Update any remaining references to old function names
- [ ] 8.3 Verify no dead code remains
- [ ] 8.4 Run linter: `bun run lint`
