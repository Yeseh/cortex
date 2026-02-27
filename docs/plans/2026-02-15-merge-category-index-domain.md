# Merge Category and Index Domain Concepts Implementation Plan

**Goal:** Unify `CategoryIndex` and related index types into the `category` module, eliminating the separate `index` module in core since "index" is a storage implementation detail, not a domain concept.

**Architecture:** At the domain level, a Category contains its metadata AND its contents (memories list, subcategories list). The `index/` module currently holds these types but "index" refers to how we store category data (in `index.yaml` files). This refactor moves all types into `category/` and deletes the `index/` module entirely. Storage layer (`IndexStorage`, `FilesystemIndexStorage`) remains unchanged - that correctly describes what it does.

**Tech Stack:** TypeScript, Bun, @yeseh/cortex-core monorepo

**Session Id:** ses_39f27c366ffew67iOffofX65Wo

---

## Pre-flight Checks

### Step 1: Verify test suite is green

```bash
bun test packages
```

- [ ] All tests pass (expect 726+)
- [ ] If any fail, fix them before proceeding

### Step 2: Create feature branch

```bash
git checkout -b refactor/merge-category-index-domain
```

---

## Phase 1: Add New Types to Category Module

### Task 1.1: Add new types in `category/types.ts`

**File:** `packages/core/src/category/types.ts`

Add these types alongside the existing CategoryStorage interface. Copy the content from `index/types.ts` but with new names:

```typescript
// Add after existing imports
import type { MemoryPath } from '@/memory/memory-path.ts';

/**
 * Entry for a memory within a category.
 * Tracks path and metadata for efficient listing without reading full files.
 */
export interface CategoryMemoryEntry {
    /** Full path to the memory (e.g., "project/cortex/conventions") */
    path: MemoryPath;
    /** Estimated token count for the memory content */
    tokenEstimate: number;
    /** Optional brief summary of memory contents */
    summary?: string;
    /** Optional last updated timestamp for sorting by recency */
    updatedAt?: Date;
}

/**
 * Entry for a subcategory within a category.
 * Tracks path, memory count, and optional description.
 */
export interface SubcategoryEntry {
    /** Full path to the subcategory (e.g., "project/cortex") */
    path: CategoryPath;
    /** Total number of memories in this subcategory */
    memoryCount: number;
    /** Optional description (max 500 chars) */
    description?: string;
}

/**
 * Complete structure for a category's contents.
 * Lists all direct memories and subcategories within a category.
 */
export interface Category {
    /** List of memory entries in this category */
    memories: CategoryMemoryEntry[];
    /** List of subcategory entries in this category */
    subcategories: SubcategoryEntry[];
}

/**
 * Error codes for index parsing failures.
 * Used by storage adapters when deserializing category data.
 */
export type IndexParseErrorCode =
    | 'INVALID_FORMAT'
    | 'INVALID_SECTION'
    | 'INVALID_ENTRY'
    | 'MISSING_FIELD'
    | 'INVALID_NUMBER';

/**
 * Error details for index parsing failures.
 */
export interface IndexParseError {
    code: IndexParseErrorCode;
    message: string;
    line?: number;
    field?: string;
    cause?: unknown;
}

/**
 * Error codes for index serialization failures.
 */
export type IndexSerializeErrorCode = 'INVALID_ENTRY' | 'INVALID_NUMBER';

/**
 * Error details for index serialization failures.
 */
export interface IndexSerializeError {
    code: IndexSerializeErrorCode;
    message: string;
    field?: string;
    cause?: unknown;
}
```

- [ ] Add all new interfaces to `category/types.ts`
- [ ] Run `bun run typecheck` - should pass (additive change)

### Task 1.2: Export new types from `category/index.ts`

**File:** `packages/core/src/category/index.ts`

Add exports for the new types:

```typescript
export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStorage,
    // New types
    Category,
    CategoryMemoryEntry,
    SubcategoryEntry,
    // Parse/serialize errors (used by storage layer)
    IndexParseErrorCode,
    IndexParseError,
    IndexSerializeErrorCode,
    IndexSerializeError,
} from './types.ts';
```

- [ ] Update exports in `category/index.ts`
- [ ] Run `bun run typecheck` - should pass

---

## Phase 2: Update Core Imports

### Task 2.1: Update `storage/adapter.ts`

**File:** `packages/core/src/storage/adapter.ts`

```typescript
// Before
import type { CategoryIndex } from '../index/types.ts';

// After
import type { Category } from '../category/types.ts';
```

Update all usages:

- `IndexStorage.read()` return type: `Category | null`
- `IndexStorage.write()` parameter type: `Category`

- [ ] Update import
- [ ] Update `IndexStorage.read()` return type
- [ ] Update `IndexStorage.write()` parameter type
- [ ] Run `bun run typecheck` - expect errors (we'll fix next)

### Task 2.2: Update `memory/operations/helpers.ts`

**File:** `packages/core/src/memory/operations/helpers.ts`

```typescript
// Before
import type { CategoryIndex } from '@/index/types.ts';

// After
import type { Category } from '@/category/types.ts';
```

Update function return type to use `Category`.

- [ ] Update import
- [ ] Update return type annotation
- [ ] Run `bun run typecheck`

### Task 2.3: Update `store/operations/helpers.ts`

**File:** `packages/core/src/store/operations/helpers.ts`

```typescript
// Before
import type { CategoryIndex } from '@/index/types.ts';

// After
import type { Category } from '@/category/types.ts';
```

Update `buildEmptyIndex` return type to `Category`.

- [ ] Update import
- [ ] Update return type annotation
- [ ] Run `bun run typecheck`

### Task 2.4: Update `memory/operations/test-helpers.spec.ts`

**File:** `packages/core/src/memory/operations/test-helpers.spec.ts`

```typescript
// Before
import type { CategoryIndex } from '@/index/types.ts';

// After
import type { Category, CategoryMemoryEntry, SubcategoryEntry } from '@/category/types.ts';
```

Update helper function types.

- [ ] Update imports
- [ ] Update type annotations
- [ ] Run `bun test packages/core` - should pass

---

## Phase 3: Update Storage-FS Package

### Task 3.1: Update `index-storage.ts` imports

**File:** `packages/storage-fs/src/index-storage.ts`

```typescript
// Before
import type { CategoryIndex } from '@yeseh/cortex-core/index';

// After
import type { Category } from '@yeseh/cortex-core/category';
```

- [ ] Update import
- [ ] Update any internal type annotations
- [ ] Run `bun run typecheck`

### Task 3.2: Update `indexes.ts` imports

**File:** `packages/storage-fs/src/indexes.ts`

```typescript
// Before
import type { CategoryIndex, IndexMemoryEntry } from '@yeseh/cortex-core/index';

// After
import type { Category, CategoryMemoryEntry } from '@yeseh/cortex-core/category';
```

- [ ] Update import
- [ ] Replace all `IndexMemoryEntry` → `CategoryMemoryEntry`
- [ ] Replace all `CategoryIndex` → `Category`
- [ ] Run `bun run typecheck`

### Task 3.3: Update `index-serialization.ts`

**File:** `packages/storage-fs/src/index-serialization.ts`

```typescript
// Before
import type { CategoryIndex } from '@yeseh/cortex-core/index';

// After
import type { Category, IndexParseError, IndexSerializeError } from '@yeseh/cortex-core/category';
```

Rename internal Zod schemas:

- `IndexMemoryEntrySchema` → `CategoryMemoryEntrySchema`
- `IndexSubcategoryEntrySchema` → `SubcategoryEntrySchema`

- [ ] Update imports
- [ ] Rename Zod schemas
- [ ] Update function signatures
- [ ] Run `bun run typecheck`
- [ ] Run `bun test packages/storage-fs` - should pass

---

## Phase 4: Delete the Index Module

### Task 4.1: Remove `index/` directory

**Delete:** `packages/core/src/index/` (entire directory)

```bash
rm -rf packages/core/src/index
```

- [ ] Delete `packages/core/src/index/types.ts`
- [ ] Delete `packages/core/src/index/index.ts`
- [ ] Delete the `packages/core/src/index/` directory

### Task 4.2: Update `packages/core/src/index.ts` barrel

**File:** `packages/core/src/index.ts`

Remove the index module export:

```typescript
// Remove this line:
export * from './index';
```

- [ ] Remove `export * from './index';` line
- [ ] Run `bun run typecheck`

### Task 4.3: Update `package.json` exports

**File:** `packages/core/package.json`

Remove the `/index` export:

```json
{
    "exports": {
        // Remove this entry:
        "./index": {
            "import": "./src/index/index.ts",
            "types": "./src/index/index.ts"
        }
    }
}
```

- [ ] Remove `"./index"` export from package.json
- [ ] Run `bun run typecheck`

---

## Phase 5: Run Full Test Suite

### Task 5.1: Run all tests

```bash
bun test packages
```

- [ ] All core tests pass
- [ ] All storage-fs tests pass
- [ ] All CLI tests pass
- [ ] All server tests pass
- [ ] Total should be 726+ tests passing

### Task 5.2: Run typecheck

```bash
bun run typecheck
```

- [ ] No type errors

### Task 5.3: Run linter

```bash
bun run lint
```

- [ ] No lint errors (or fix any that appear)

---

## Phase 6: Commit and Cleanup

### Task 6.1: Commit changes

```bash
git add -A
git commit -m "refactor(core): merge index types into category module

- Add Category, CategoryMemoryEntry, SubcategoryEntry to category module
- Move IndexParseError, IndexSerializeError to category module
- Delete packages/core/src/index/ module entirely
- Update all imports in core and storage-fs
- Remove @yeseh/cortex-core/index export path

BREAKING CHANGE: @yeseh/cortex-core/index export removed, use @yeseh/cortex-core/category"
```

- [ ] Commit with descriptive message

### Task 6.2: Remove completed todo from memory

```bash
# Use MCP tool or CLI to remove the todo
cortex memory remove todo/merge-categories-indexes
```

- [ ] Remove the todo memory entry

---

## Summary of Changes

### Files Modified

| File                                              | Change                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `core/src/category/types.ts`                      | Add `Category`, `CategoryMemoryEntry`, `SubcategoryEntry`, parse/serialize errors |
| `core/src/category/index.ts`                      | Export new types                                                                  |
| `core/src/storage/adapter.ts`                     | Use `Category` instead of `CategoryIndex`                                         |
| `core/src/memory/operations/helpers.ts`           | Update import                                                                     |
| `core/src/store/operations/helpers.ts`            | Update import                                                                     |
| `core/src/memory/operations/test-helpers.spec.ts` | Update imports                                                                    |
| `core/src/index.ts`                               | Remove `export * from './index'`                                                  |
| `core/package.json`                               | Remove `./index` export                                                           |
| `storage-fs/src/index-storage.ts`                 | Update import                                                                     |
| `storage-fs/src/indexes.ts`                       | Update imports, rename types                                                      |
| `storage-fs/src/index-serialization.ts`           | Update imports, rename schemas                                                    |

### Files Deleted

| File                      | Reason                        |
| ------------------------- | ----------------------------- |
| `core/src/index/types.ts` | Merged into category/types.ts |
| `core/src/index/index.ts` | No longer needed              |

### Unchanged

- `IndexStorage` interface name (correctly describes storage concern)
- `FilesystemIndexStorage` class name (correctly describes implementation)
- CLI package (uses core types indirectly)
- Server package (uses core types indirectly)

---

## Rollback Plan

If issues arise:

1. `git checkout main`
2. Delete feature branch: `git branch -D refactor/merge-category-index-domain`
