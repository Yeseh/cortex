# Add Scoped Prune and Reindex Implementation Plan

**Goal:** Make prune and reindex operations scope-aware, operating only on memories/categories under the specified CategoryPath scope instead of the entire store.

**Architecture:** Add required `scope: CategoryPath` parameter to both operations. When `scope.isRoot` is true, process entire store (current behavior). Otherwise, only process the subtree under `scope`. Update CategoryClient to pass its parsed path as the scope.

**Tech Stack:** TypeScript, Bun, Result types, CategoryPath value object
**Session Id:** ses_38f52f2a1ffeE70LDH540yxV11

---

## Implementation Tasks

### 1. Add CategoryPath.isUnderOrEquals() Method

The `CategoryPath` class needs a method to check if one path is under or equal to another scope. This is required for filtering in both prune and reindex.

**File:** `packages/core/src/category/category-path.ts`

**Add method:**

```typescript
/**
 * Check if this path is under or equal to the given scope.
 *
 * Root scope matches everything. For non-root scopes,
 * this path must either equal the scope or be a descendant.
 *
 * @param scope - The scope to check against
 * @returns true if this path is under or equal to scope
 */
isUnder(scope: CategoryPath): boolean {
    // Root scope matches everything
    if (scope.isRoot) {
        return true;
    }

    // This path must start with scope's segments
    if (this.depth < scope.depth) {
        return false;
    }

    const scopeSegments = scope.#segments;
    for (let i = 0; i < scopeSegments.length; i++) {
        if (!this.#segments[i]!.equals(scopeSegments[i]!)) {
            return false;
        }
    }
    return true;
}
```

**Tests to add in `category-path.spec.ts`:**

- Root scope matches everything (root, any category)
- Non-root scope matches itself
- Non-root scope matches descendants (e.g., `standards` matches `standards/typescript`)
- Non-root scope does NOT match unrelated paths (e.g., `standards` does not match `human`)
- Non-root scope does NOT match ancestors (e.g., `standards/typescript` does not match `standards`)

---

### 2. Update pruneExpiredMemories with Scope Parameter

**File:** `packages/core/src/memory/operations/prune.ts`

**Changes:**

1. Add `scope: CategoryPath` as the **second** required parameter (after `storage`)
2. When `scope.isRoot`, discover root categories as before
3. When `!scope.isRoot`, start collection from `scope` directly without discovering root categories
4. Use `CategoryPath.isUnder(scope)` to filter which memories are processed

**Updated signature:**

```typescript
export const pruneExpiredMemories = async (
    storage: ScopedStorageAdapter,
    scope: CategoryPath,
    options?: PruneOptions,
): Promise<Result<PruneResult, MemoryError>> => { ... }
```

**Updated logic:**

```typescript
// When scope is root, discover all root categories
// When scope is a specific category, start from that category
let rootCategories: CategoryPath[];
if (scope.isRoot) {
    const rootCategoriesResult = await discoverRootCategories(storage);
    if (!rootCategoriesResult.ok()) {
        return rootCategoriesResult;
    }
    rootCategories = rootCategoriesResult.value;
} else {
    // Start from the scope category directly
    rootCategories = [scope];
}
```

---

### 3. Update helpers.ts to Support Scoped Collection

**File:** `packages/core/src/memory/operations/helpers.ts`

The `discoverRootCategories` function may need updating if we want to discover subcategories of a specific scope. However, since `pruneExpiredMemories` already calls `collectMemoriesFromCategory` recursively, we can simply pass the scope as the starting point.

**Change `collectMemoriesFromCategory`** - Actually, this function already recursively collects memories, so no changes needed here. The scoping is applied at the entry point in `pruneExpiredMemories`.

---

### 4. Update IndexStorage.reindex() Interface with Scope Parameter

**File:** `packages/core/src/storage/adapter.ts`

**Changes to IndexStorage interface:**

```typescript
/**
 * Rebuilds category indexes from the current filesystem state.
 *
 * @param scope - The category scope to reindex. Pass CategoryPath.root()
 *                for store-wide reindexing. Non-root scopes only rebuild
 *                indexes for categories under that path.
 */
reindex(scope: CategoryPath): Promise<Result<ReindexResult, StorageAdapterError>>;
```

---

### 5. Update FilesystemIndexStorage.reindex() Implementation

**File:** `packages/storage-fs/src/index-storage.ts`

**Changes:**

```typescript
async reindex(scope: CategoryPath): Promise<Result<ReindexResult, StorageAdapterError>> {
    return reindexCategoryIndexes(this.ctx, scope);
}
```

---

### 6. Update reindexCategoryIndexes in indexes.ts

**File:** `packages/storage-fs/src/indexes.ts`

This is the core change for scoped reindexing. Two approaches:

**Option A (Simpler):** Filter the collected memory files to only include those under the scope, then rebuild indexes only for affected categories.

**Option B (More efficient):** Only scan directories under the scope.

**Choose Option A** for simplicity and correctness:

**Changes to `reindexCategoryIndexes`:**

```typescript
export const reindexCategoryIndexes = async (
    ctx: FilesystemContext,
    scope: CategoryPath = CategoryPath.root()
): Promise<Result<ReindexResult, StorageAdapterError>> => {
    // Determine the target root for scanning
    // When scope is root, scan entire store
    // When scope is specific, scan only that subtree
    const targetRoot = scope.isRoot ? ctx.storeRoot : resolve(ctx.storeRoot, scope.toString());

    // ... existing logic but operating on targetRoot
    // When writing indexes, ensure we only update indexes under scope
    // When removing stale indexes, only remove those under scope
};
```

This will require passing `scope` through to helper functions and updating path resolution.

---

### 7. Update pruneExpiredMemories to call scoped reindex

**File:** `packages/core/src/memory/operations/prune.ts`

After deleting memories, call reindex with the scope:

```typescript
if (expiredMemories.length > 0) {
    const reindexResult = await storage.indexes.reindex(scope);
    // ...
}
```

---

### 8. Update CategoryClient.prune() to pass scope

**File:** `packages/core/src/cortex/category-client.ts`

**Changes to prune method:**

```typescript
async prune(options?: PruneOptions): Promise<Result<PruneResult, CategoryError>> {
    const pathResult = this.parsePath();
    if (!pathResult.ok()) {
        return pathResult;
    }

    const pruneResult = await pruneExpiredMemories(
        this.adapter,
        pathResult.value,  // Pass the category path as scope
        options
    );
    // ... rest unchanged
}
```

Update JSDoc:

```typescript
/**
 * Remove expired memories from this category subtree.
 *
 * Finds and deletes all memories that have passed their expiration
 * date within this category and its subcategories. Use from root
 * category for store-wide pruning.
 * ...
 */
```

---

### 9. Update CategoryClient.reindex() to pass scope

**File:** `packages/core/src/cortex/category-client.ts`

**Changes to reindex method:**

```typescript
async reindex(): Promise<Result<ReindexResult, CategoryError>> {
    const pathResult = this.parsePath();
    if (!pathResult.ok()) {
        return pathResult;
    }

    const reindexResult = await this.adapter.indexes.reindex(pathResult.value);
    // ... rest unchanged
}
```

Update JSDoc:

```typescript
/**
 * Rebuild indexes for this category subtree.
 *
 * Scans categories under this path and regenerates their index files
 * from the current filesystem state. Use from root category for
 * store-wide reindexing.
 * ...
 */
```

---

### 10. Update existing tests

**Files to update:**

- `packages/core/src/memory/operations/prune.spec.ts` - Add `CategoryPath.root()` to all existing test calls
- `packages/storage-fs/src/indexes.spec.ts` - Add `CategoryPath.root()` to reindex calls
- `packages/storage-fs/src/index-storage.spec.ts` - Add scope parameter to reindex tests

---

### 11. Add new tests for scoped behavior

**Prune tests (prune.spec.ts):**

- Should only prune memories under scope (e.g., scope `project` ignores `human` category)
- Should reindex only the scope after pruning
- Should handle empty subtrees gracefully
- Root scope should behave like current store-wide behavior

**Reindex tests (indexes.spec.ts):**

- Should only reindex categories under scope
- Should not modify indexes outside scope
- Should handle non-existent scope directory gracefully
- Root scope should reindex entire store

---

## Dependency Graph

```
Task 1: CategoryPath.isUnder() method
    ↓
Task 2 & 3: pruneExpiredMemories scope parameter + helpers
    ↓
Task 4 & 5: IndexStorage.reindex() interface update
    ↓
Task 6: reindexCategoryIndexes implementation
    ↓
Task 7: pruneExpiredMemories calls scoped reindex
    ↓
Task 8 & 9: CategoryClient updates (prune, reindex)
    ↓
Task 10 & 11: Test updates (can run in parallel after implementation)
```

## Parallelization Opportunities

- Tasks 2 & 4 can be started in parallel (both are interface changes)
- Tasks 10 & 11 can be developed in parallel
- Task 1 must complete before Tasks 2, 3, 6

## Breaking Changes

This is a **breaking change** for:

1. `pruneExpiredMemories()` - new required `scope` parameter
2. `IndexStorage.reindex()` - new required `scope` parameter

Existing callers must be updated to pass `CategoryPath.root()` for store-wide behavior.
