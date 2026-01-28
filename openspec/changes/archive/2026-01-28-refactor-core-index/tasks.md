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

- [x] 3.1 Evaluate if pure operations exist after serialization refactor completes
- [x] 3.2 Decision: No operations module needed (see notes below)
- [x] 3.3 N/A - No operations module created
- [x] 3.4 ~~If no operations needed: Document decision in code comment~~ Added comment in barrel export explaining this

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

### Operations Module Decision (Task 3)

After evaluating the index module post-serialization refactor, **no operations module is needed** because:

1. **Index manipulation is storage-bound**: All index operations (upsert, read, write, reindex) require filesystem access and live appropriately in `core/storage/filesystem/indexes.ts`

2. **No pure domain logic**: Unlike `core/category/operations.ts` which has pure helpers (`isRootCategory`, `getParentPath`, `getAncestorPaths`), the index module has no similar domain logic independent of storage

3. **Serialization is centralized**: Parse/serialize functions are in `core/serialization.ts` (`parseIndex`, `serializeIndex`)

4. **Types are sufficient**: `CategoryIndex`, `IndexMemoryEntry`, and `IndexSubcategoryEntry` are simple data structures with no invariants requiring enforcement code

The barrel export (`src/core/index/index.ts`) includes a JSDoc comment explaining that parsing/serialization is available in `core/serialization`.
