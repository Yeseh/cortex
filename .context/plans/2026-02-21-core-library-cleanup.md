# Core Library Cleanup Implementation Plan

**Goal:** Remove dead code, fix legacy patterns, and simplify the core library to improve maintainability
**Architecture:** Systematic cleanup across core modules (storage, memory, category, store) following ISP and Result-type conventions
**Tech Stack:** TypeScript, Bun test
**Session Id:** undefined

---

## Background

A thorough review of `packages/core/` identified dead code, unused exports, legacy patterns, and simplification opportunities. This plan provides bite-sized tasks to clean up the codebase.

## Scope

This plan focuses on **core library only** (`packages/core/`). Changes that require modifications to `storage-fs`, `cli`, or `server` are noted but deferred unless explicitly approved.

---

## Phase 1: Dead Code Removal (High Priority)

### 1.1 Delete `serializer.ts`

**What:** The `MemorySerializer` interface is defined but never imported or implemented anywhere.

**Files:**

- `packages/core/src/serializer.ts` (DELETE)

**Steps:**

- [ ] 1.1.1 Verify no imports exist: `grep -r "serializer" packages/`
- [ ] 1.1.2 Delete `packages/core/src/serializer.ts`
- [ ] 1.1.3 Run `bun test packages/core` to confirm no breakage
- [ ] 1.1.4 Commit: `chore(core): remove unused serializer.ts`

---

### 1.2 Remove unused `getCategoryFromSlugPath` helper

**What:** Function defined in helpers.ts but the only call site assigns to an unused variable.

**Files:**

- `packages/core/src/memory/operations/helpers.ts:240-243`
- `packages/core/src/memory/operations/move.ts:91`

**Steps:**

- [ ] 1.2.1 Verify `destCategory` variable in move.ts is unused after assignment
- [ ] 1.2.2 Remove `const destCategory = getCategoryFromSlugPath(toPath);` from move.ts:91
- [ ] 1.2.3 Remove `getCategoryFromSlugPath` function from helpers.ts:240-243
- [ ] 1.2.4 Run `bun test packages/core/src/memory` to confirm tests pass
- [ ] 1.2.5 Commit: `chore(core): remove unused getCategoryFromSlugPath helper`

---

### 1.3 Remove unused index error types

**What:** Index error types are exported but never imported by consumers.

**Files:**

- `packages/core/src/category/types.ts` (remove type definitions)
- `packages/core/src/category/index.ts` (remove from exports)

**Types to remove:**

- `IndexParseErrorCode`
- `IndexParseError`
- `IndexSerializeErrorCode`
- `IndexSerializeError`

**Steps:**

- [ ] 1.3.1 Verify no imports exist: `grep -r "IndexParseError\|IndexSerializeError" packages/`
- [ ] 1.3.2 Remove type exports from `category/index.ts:20-23`
- [ ] 1.3.3 Remove type definitions from `category/types.ts` (search for `IndexParseErrorCode`)
- [ ] 1.3.4 Run `bun test packages/core` to confirm no breakage
- [ ] 1.3.5 Run `bun run typecheck` to confirm no type errors
- [ ] 1.3.6 Commit: `chore(core): remove unused index error types`

---

### 1.4 Remove unused StoreErrorCode values

**What:** Some error codes in the union type are never used.

**File:** `packages/core/src/store/result.ts`

**Codes to remove:**

- `STORE_INIT_FAILED`
- `MISSING_STORE_PATH`
- `INVALID_STORE_NAME` (redundant with `STORE_NAME_INVALID`)

**Steps:**

- [ ] 1.4.1 Verify each code is unused: `grep -r "STORE_INIT_FAILED\|MISSING_STORE_PATH\|INVALID_STORE_NAME" packages/`
- [ ] 1.4.2 Remove unused codes from `StoreErrorCode` union in `store/result.ts`
- [ ] 1.4.3 Run `bun run typecheck` to confirm no type errors
- [ ] 1.4.4 Commit: `chore(core): remove unused StoreErrorCode values`

---

### 1.5 Clean up unused barrel exports

**What:** Several exports from `index.ts` are only used internally or never used.

**File:** `packages/core/src/index.ts`

**Exports to evaluate:**

- `toonOptions` - only used internally in serialization.ts
- `deserialize` - tested but never imported by consumers
- `CortexErrorCode`, `CortexClientError`, `CortexClientResult` - never imported
- `createDefaultAdapterFactory` - only used in core tests

**Steps:**

- [ ] 1.5.1 For each export, verify usage: `grep -r "toonOptions" packages/{cli,server,storage-fs}/`
- [ ] 1.5.2 Remove confirmed-unused exports from `index.ts`
- [ ] 1.5.3 Run `bun run build` to confirm packages still compile
- [ ] 1.5.4 Run `bun test packages/` to confirm no breakage
- [ ] 1.5.5 Commit: `chore(core): remove unused exports from barrel`

---

## Phase 2: Syntax and Typo Fixes (Medium Priority)

### 2.1 Fix syntax error in category-templates.ts

**What:** Invalid `}!;` syntax on lines 26 and 49.

**File:** `packages/core/src/category/category-templates.ts:26,49`

**Steps:**

- [ ] 2.1.1 Change `}!;` to `};` on line 26
- [ ] 2.1.2 Change `}!;` to `};` on line 49
- [ ] 2.1.3 Run `bun run typecheck` to confirm fix
- [ ] 2.1.4 Commit: `fix(core): fix syntax error in category-templates.ts`

---

### 2.2 Fix typo `CreatedCatagory`

**What:** Misspelled type alias.

**File:** `packages/core/src/category/operations/create.ts:9`

**Steps:**

- [ ] 2.2.1 Rename `CreatedCatagory` to `CreateCategoryResultType` (or use original name directly)
- [ ] 2.2.2 Run `bun run typecheck` to confirm fix
- [ ] 2.2.3 Commit: `fix(core): fix typo CreatedCatagory → CreateCategoryResultType`

---

## Phase 3: Simplification (Medium Priority)

### 3.1 Remove unused `root` getter from CategoryPath

**What:** Instance getter `.root` is never called (only static `CategoryPath.root()` is used).

**File:** `packages/core/src/category/category-path.ts:47-49`

**Steps:**

- [ ] 3.1.1 Verify no usage: `grep -r "\.root[^C(]" packages/`
- [ ] 3.1.2 Remove the instance `root` getter (lines 47-49)
- [ ] 3.1.3 Run `bun test packages/core/src/category` to confirm tests pass
- [ ] 3.1.4 Commit: `chore(core): remove unused CategoryPath.root getter`

---

### 3.2 Simplify Symbol.toPrimitive implementations

**What:** The if-check is redundant since both branches return `toString()`.

**Files:**

- `packages/core/src/slug.ts:42-47`
- `packages/core/src/category/category-path.ts:133-138`
- `packages/core/src/memory/memory-path.ts:55-60`

**Steps:**

- [ ] 3.2.1 Simplify `slug.ts` Symbol.toPrimitive to just return `this.toString()`
- [ ] 3.2.2 Simplify `category-path.ts` Symbol.toPrimitive
- [ ] 3.2.3 Simplify `memory-path.ts` Symbol.toPrimitive
- [ ] 3.2.4 Run `bun test packages/core` to confirm behavior unchanged
- [ ] 3.2.5 Commit: `refactor(core): simplify Symbol.toPrimitive implementations`

---

### 3.3 Make MemoryPath.fromSegments private

**What:** `fromSegments` is only called internally by `fromString`.

**File:** `packages/core/src/memory/memory-path.ts`

**Steps:**

- [ ] 3.3.1 Verify no external usage: `grep -r "fromSegments" packages/{cli,server,storage-fs}/`
- [ ] 3.3.2 Change `static fromSegments` to private static method
- [ ] 3.3.3 Remove from exports in `memory/index.ts` if exported
- [ ] 3.3.4 Run `bun run typecheck && bun test packages/core`
- [ ] 3.3.5 Commit: `refactor(core): make MemoryPath.fromSegments private`

---

## Phase 4: Documentation Updates (Low Priority)

### 4.1 Remove unused StorageAdapterResult type

**What:** Type alias defined but never imported.

**File:** `packages/core/src/storage/index.ts:41`

**Steps:**

- [ ] 4.1.1 Verify no usage: `grep -r "StorageAdapterResult" packages/`
- [ ] 4.1.2 Remove type definition and export
- [ ] 4.1.3 Run `bun run typecheck`
- [ ] 4.1.4 Commit: `chore(core): remove unused StorageAdapterResult type`

---

## Deferred Items (Require Cross-Package Changes)

These items are documented but not included in this plan:

### D.1 Remove `MemoryAdapter.add()` method

- **Why deferred:** Requires changes to `storage-fs` implementation
- **Impact:** Low - method is never called
- **Files:** `storage/memory-adapter.ts`, `storage-fs/src/memories.ts`

### D.2 Remove `defaultProjectCategories`

- **Why deferred:** May be intended for future CLI `init --project` feature
- **Impact:** None - unused
- **Decision:** Keep with comment or remove in separate PR

### D.3 Standardize `*Adapter` vs `*Storage` naming

- **Why deferred:** Large refactor affecting public API, requires updating all imports
- **Impact:** Breaking change for external consumers
- **Recommendation:** Create separate migration plan

### D.4 Extract shared `normalizePath` utility

- **Why deferred:** Refactor across MemoryClient and CategoryClient
- **Impact:** Moderate - reduces duplication
- **Files:** `memory-client.ts`, `category-client.ts`

### D.5 Update legacy comments in storage-fs

- **Why deferred:** Outside core scope
- **Files:** `storage-fs/src/index.ts` (references to ComposedStorageAdapter, ScopedStorageAdapter)

---

## Verification Checklist

After completing all phases:

- [ ] `bun run typecheck` passes
- [ ] `bun test packages/core` passes
- [ ] `bun run build` succeeds
- [ ] `bun test packages/` (full suite) passes
- [ ] No new lint warnings introduced

---

## Summary

| Phase                      | Tasks        | Estimated Time |
| -------------------------- | ------------ | -------------- |
| Phase 1: Dead Code Removal | 5 tasks      | 30-45 min      |
| Phase 2: Syntax/Typo Fixes | 2 tasks      | 10 min         |
| Phase 3: Simplification    | 3 tasks      | 20 min         |
| Phase 4: Documentation     | 1 task       | 5 min          |
| **Total**                  | **11 tasks** | **~1 hour**    |

All changes are backwards-compatible and do not affect the public API.
