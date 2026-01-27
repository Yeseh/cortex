## 1. Create domain types

- [x] 1.1 Create `src/core/memory/types.ts` with `MemoryMetadata` type (using `type`, not `interface`)
- [x] 1.2 Add `Memory` type combining metadata and content
- [x] 1.3 Add `MemoryErrorCode` discriminated union
- [x] 1.4 Add `MemoryError` type with code, message, path, cause fields
- [x] 1.5 Add JSDoc with `@module` tag and comprehensive documentation

## 2. Create format adapter

- [x] 2.1 Create `src/core/memory/formats/` directory
- [x] 2.2 Create `formats/frontmatter.ts` with parsing/serialization logic from `file.ts`
- [x] 2.3 Rename functions: `parseMemoryFile` → `parseFrontmatter`, `serializeMemoryFile` → `serializeFrontmatter`
- [x] 2.4 Define format-specific error types (`FrontmatterParseError`, `FrontmatterSerializeError`)
- [x] 2.5 Import `ok`/`err` from `../../result.ts` instead of local definitions
- [x] 2.6 Add comprehensive JSDoc with `@module`, `@param`, `@returns`, `@example`
- [x] 2.7 Improve error messages with actionable guidance
- [x] 2.8 Create `formats/index.ts` barrel export

## 3. Create module barrel export

- [x] 3.1 Create `src/core/memory/index.ts`
- [x] 3.2 Export types with `export type { ... }` (MemoryMetadata, Memory, MemoryError, etc.)
- [x] 3.3 Export validation functions from `validation.ts`
- [x] 3.4 Re-export format adapters from `formats/`

## 4. Update validation module

- [x] 4.1 Update `validation.ts` to import `ok`/`err` from `../result.ts`
- [x] 4.2 Add `@module` JSDoc tag
- [x] 4.3 Add comprehensive JSDoc to exported functions

## 5. Clean up core types

- [x] 5.1 Remove incomplete `MemoryMetadata` interface from `src/core/types.ts`
- [x] 5.2 Verify no other code depends on the removed type

## 6. Split and update tests

- [x] 6.1 Create `src/core/memory/validation.spec.ts` with validation tests from `memory.spec.ts`
- [x] 6.2 Create `src/core/memory/formats/frontmatter.spec.ts` with parsing/serialization tests
- [x] 6.3 Delete `src/core/memory/memory.spec.ts`
- [x] 6.4 Verify all tests pass

## 7. Update consumers

- [x] 7.1 Find all imports of `parseMemoryFile`/`serializeMemoryFile`
- [x] 7.2 Update imports to use new paths and function names
- [x] 7.3 Update any references to `MemoryFileFrontmatter`/`MemoryFileContents`

## 8. Delete old file

- [x] 8.1 Delete `src/core/memory/file.ts` after all consumers updated
- [x] 8.2 Run full test suite to verify nothing broken

## 9. Final verification

- [x] 9.1 Run `bun test` - all tests pass (29 memory module tests pass)
- [x] 9.2 Run `bun run typecheck` - no new type errors introduced (pre-existing issues in output.spec.ts)
- [x] 9.3 Verify barrel export works: `import { Memory, parseFrontmatter } from './core/memory'`
