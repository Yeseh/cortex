# Tasks

## 1. Add JSDoc documentation to types.ts

- [ ] 1.1 Add `@module core/index/types` header with module description
- [ ] 1.2 Document `IndexMemoryEntry` interface with field descriptions
- [ ] 1.3 Document `IndexSubcategoryEntry` interface with field descriptions
- [ ] 1.4 Document `CategoryIndex` interface with purpose and usage examples
- [ ] 1.5 Document `IndexParseErrorCode` with explanation of each error condition
- [ ] 1.6 Document `IndexParseError` interface with field meanings
- [ ] 1.7 Document `IndexSerializeErrorCode` with explanation of each error condition
- [ ] 1.8 Document `IndexSerializeError` interface with field meanings
- [ ] 1.9 Add `@example` blocks showing typical index structures

## 2. Align error types with project standards

- [ ] 2.1 Add optional `cause?: unknown` field to `IndexParseError` (forward compatibility)
- [ ] 2.2 Add optional `cause?: unknown` field to `IndexSerializeError` (forward compatibility)
- [ ] 2.3 Consider extracting `INDEX_FILE_NAME` constant (currently hardcoded as `index.yaml`)

## 3. Create operations module (if applicable)

- [ ] 3.1 Evaluate if pure operations exist after serialization refactor completes
- [ ] 3.2 If operations exist: Create `operations.ts` following category pattern
- [ ] 3.3 If operations exist: Add JSDoc with `@module`, `@example`, `@param`, `@returns`
- [ ] 3.4 If no operations needed: Document decision in code comment

## 4. Update barrel export

- [ ] 4.1 Update `src/core/index/index.ts` to include any new exports
- [ ] 4.2 Verify exports match public API expectations
- [ ] 4.3 Add module-level JSDoc comment to barrel

## 5. Verification

- [ ] 5.1 Run typecheck: `bun run typecheck`
- [ ] 5.2 Run tests: `bun test src/core/index`
- [ ] 5.3 Verify documentation renders correctly in IDE hover
- [ ] 5.4 Compare documentation style with `src/core/category/types.ts`
