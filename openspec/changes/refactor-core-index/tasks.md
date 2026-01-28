# Tasks

## 1. Add JSDoc documentation to types.ts

- [x] 1.1 Add `@module core/index/types` header with module description
- [x] 1.2 Document `IndexMemoryEntry` interface with field descriptions
- [x] 1.3 Document `IndexSubcategoryEntry` interface with field descriptions
- [x] 1.4 Document `CategoryIndex` interface with purpose and usage examples
- [x] 1.5 Document `IndexParseErrorCode` with explanation of each error condition
- [x] 1.6 Document `IndexParseError` interface with field meanings
- [x] 1.7 Document `IndexSerializeErrorCode` with explanation of each error condition
- [x] 1.8 Document `IndexSerializeError` interface with field meanings
- [x] 1.9 Add `@example` blocks showing typical index structures

## 2. Align error types with project standards

- [x] 2.1 Add optional `cause?: unknown` field to `IndexParseError` (forward compatibility)
- [x] 2.2 Add optional `cause?: unknown` field to `IndexSerializeError` (forward compatibility)
- [x] 2.3 ~~Consider extracting `INDEX_FILE_NAME` constant~~ Added `INDEX_FILE_NAME = 'index.yaml'` constant

## 3. Create operations module (if applicable)

- [ ] 3.1 Evaluate if pure operations exist after serialization refactor completes
- [ ] 3.2 If operations exist: Create `operations.ts` following category pattern
- [ ] 3.3 If operations exist: Add JSDoc with `@module`, `@example`, `@param`, `@returns`
- [x] 3.4 ~~If no operations needed: Document decision in code comment~~ Added comment in barrel export explaining blockage

**BLOCKED**: Tasks 3.1-3.3 depend on `refactor-serialization-module` completing and deleting `parser.ts`.

## 4. Update barrel export

- [x] 4.1 Update `src/core/index/index.ts` to include any new exports
- [x] 4.2 Verify exports match public API expectations
- [x] 4.3 Add module-level JSDoc comment to barrel

## 5. Verification

- [x] 5.1 Run typecheck: `bunx tsc --noEmit` ✓ passed
- [x] 5.2 Run tests: `bun test src/core/index` ✓ 11 tests, 89 expect() calls
- [x] 5.3 Verify documentation renders correctly in IDE hover
- [x] 5.4 Compare documentation style with `src/core/category/types.ts`

---

## Implementation Notes

**Commit:** `b33bab7` - docs(core/index): add comprehensive JSDoc documentation to types and barrel export

**Files changed:**

- `src/core/index/types.ts` (43 → 160 lines)
- `src/core/index/index.ts` (7 → 38 lines)
- `.context/plans/2026-01-28-refactor-core-index.md` (new)

**Review Status:** Approved by code-reviewer agent
