## 1. Policy module — types and resolution

- [ ] 1.1 Create `packages/core/src/policy/types.ts` with `EffectivePolicy`, `PolicyValidator<T>`, `PolicyTransformer<T>`, and `PolicyError` types
- [ ] 1.2 Write failing tests for `resolveEffectivePolicy` (inheritance scenarios, missing categories, system defaults)
- [ ] 1.3 Implement `packages/core/src/policy/operations/resolve.ts` — walks in-memory store config up hierarchy, merges policy fragments
- [ ] 1.4 Run tests and confirm resolve tests pass
- [ ] 1.5 Commit: `feat(core): add policy resolution`

## 2. Policy validators

- [ ] 2.1 Write failing tests for `checkCreatePermission`
- [ ] 2.2 Implement `packages/core/src/policy/validators/permissions.ts` — `checkCreatePermission`, `checkUpdatePermission`, `checkDeletePermission`
- [ ] 2.3 Run tests and confirm permissions validator tests pass
- [ ] 2.4 Write failing tests for `validateMaxContentLength`
- [ ] 2.5 Implement `packages/core/src/policy/validators/content-length.ts`
- [ ] 2.6 Run tests and confirm content-length tests pass
- [ ] 2.7 Write failing tests for `validateSubcategoryCreation`
- [ ] 2.8 Implement `packages/core/src/policy/validators/subcategory.ts`
- [ ] 2.9 Run tests and confirm subcategory tests pass
- [ ] 2.10 Commit: `feat(core): add policy validators`

## 3. Policy transformer and runner

- [ ] 3.1 Write failing tests for `applyDefaultTtl` (no expiry → apply ceiling, expiry under ceiling → unchanged, expiry over ceiling → reduce)
- [ ] 3.2 Implement `packages/core/src/policy/transformers/ttl.ts`
- [ ] 3.3 Run tests and confirm TTL transformer tests pass
- [ ] 3.4 Write failing tests for `runValidation` and `runTransformation` in runner
- [ ] 3.5 Implement `packages/core/src/policy/runner.ts`
- [ ] 3.6 Run tests and confirm runner tests pass
- [ ] 3.7 Add barrel exports to `packages/core/src/policy/index.ts`
- [ ] 3.8 Commit: `feat(core): add policy transformers and runner`

## 4. Config schema — remove categoryMode, add policies

- [ ] 4.1 Update config schema types to remove `categoryMode` field from store definitions
- [ ] 4.2 Add optional `policies` block to category definition type (mirrors `EffectivePolicy` but all fields optional)
- [ ] 4.3 Update YAML parsing to handle `policies` block with partial `permissions` declaration (defaults missing fields to `true`)
- [ ] 4.4 Update config validation to reject `categoryMode` field with helpful error
- [ ] 4.5 Update existing tests that reference `categoryMode`
- [ ] 4.6 Run `bun test packages/core` and confirm config tests pass
- [ ] 4.7 Commit: `feat(core): remove categoryMode, add category policies to config schema`

## 5. Memory operations — compose policy pipeline

- [ ] 5.1 Write failing tests for `createMemory` with policy violations (create denied, content too long) and transformations (TTL ceiling applied)
- [ ] 5.2 Update `packages/core/src/memory/operations/create.ts` to resolve policy and run pipeline
- [ ] 5.3 Write failing tests for `updateMemory` with policy violations (update denied, content too long)
- [ ] 5.4 Update `packages/core/src/memory/operations/update.ts`
- [ ] 5.5 Write failing tests for `deleteMemory` with policy violations (delete denied)
- [ ] 5.6 Update `packages/core/src/memory/operations/delete.ts`
- [ ] 5.7 Run `bun test packages/core` and confirm all memory tests pass
- [ ] 5.8 Commit: `feat(core): enforce category policies in memory operations`

## 6. Category operations — compose policy pipeline

- [ ] 6.1 Write failing tests for `createCategory` when `subcategoryCreation: false` on parent
- [ ] 6.2 Update `packages/core/src/category/operations/create.ts`
- [ ] 6.3 Write failing tests for `deleteCategory` when `delete: false`
- [ ] 6.4 Update `packages/core/src/category/operations/delete.ts`
- [ ] 6.5 Write failing tests for `setDescription` when `update: false`
- [ ] 6.6 Update `packages/core/src/category/operations/set-description.ts`
- [ ] 6.7 Run `bun test packages/core` and confirm all category tests pass
- [ ] 6.8 Commit: `feat(core): enforce category policies in category operations`

## 7. Full test suite and build

- [ ] 7.1 Run `bun test packages` — all tests pass
- [ ] 7.2 Run `bunx tsc --build` — no type errors
- [ ] 7.3 Run `bunx eslint packages/*/src/**/*.ts --fix` — no lint errors
- [ ] 7.4 Commit any lint fixes: `chore(core): lint fixes`
