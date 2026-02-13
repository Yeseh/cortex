# Fix Prune/Reindex Consistency Implementation Plan

**Goal:** Fix `reindexCategoryIndexes` to clean up stale index files for categories that no longer contain memories, and refactor the CLI prune command to delegate to core instead of reimplementing prune logic.  
**Architecture:** The fix targets `packages/storage-fs/src/indexes.ts` (reindex cleanup) and `packages/cli/src/commands/store/prune/command.ts` (thin-wrapper refactor). Core `pruneExpiredMemories` already calls reindex after deletion, so fixing reindex fixes the consistency issue end-to-end.  
**Tech Stack:** TypeScript, Bun test, filesystem (node:fs/promises), YAML indexes  
**Session Id:** ses_3a7bdf066ffewMoUOME1UfAv7s

---

## Problem Analysis

Two bugs and one code quality issue:

### Bug 1: Reindex leaves stale index files on disk

`reindexCategoryIndexes()` in `packages/storage-fs/src/indexes.ts:664` scans the filesystem for `.md` memory files, builds a fresh index map, then writes new `index.yaml` files — but it only **writes** index files for categories present in the new map. It never **deletes** index files for categories that no longer have memories (e.g., after all memories in a category were pruned). The stale `index.yaml` files persist on disk, causing phantom categories to appear in listings.

### Bug 2: Stale index entries after prune (consequence of Bug 1)

Core `pruneExpiredMemories()` (`packages/core/src/memory/operations.ts:875`) does call `storage.indexes.reindex()` after deleting expired memories (line 934). However, since reindex doesn't clean up stale index files (Bug 1), pruned memories still leave behind phantom category entries.

### Code quality: CLI prune reimplements core logic

`packages/cli/src/commands/store/prune/command.ts` has ~200 lines of independent prune logic (`collectAllExpired`, `deleteExpiredMemories`, `checkMemoryExpiry`, etc.) instead of delegating to core `pruneExpiredMemories()`. This violates the "thin entrypoints" architectural principle.

## Plan

### Phase 1: Fix reindex to clean up stale index files

#### Step 1.1: Write a failing test for stale index cleanup

**File:** `packages/storage-fs/src/indexes.spec.ts` (new file)

Write a test that:
1. Creates a temp directory with `mkdtemp()`
2. Sets up a store with two categories (`alpha/` and `beta/`) each having memories and `index.yaml` files
3. Removes all memory files from `beta/` (simulating a prune)
4. Calls `reindexCategoryIndexes(ctx)`
5. Asserts that `beta/index.yaml` no longer exists on disk
6. Asserts that the root `index.yaml` no longer lists `beta` as a subcategory
7. Asserts that `alpha/index.yaml` still exists and is correct

Use `FilesystemContext` directly (same pattern as `categories.spec.ts`).

#### Step 1.2: Run the test and confirm it fails

```bash
bun test packages/storage-fs/src/indexes.spec.ts
```

#### Step 1.3: Implement stale index cleanup in `reindexCategoryIndexes`

**File:** `packages/storage-fs/src/indexes.ts`

In `reindexCategoryIndexes()` (line 664-685), after building the new index state and before/after writing new indexes:

1. **Before writing**: Collect all existing `index.yaml` files on disk by scanning the filesystem (reuse `readDirEntries` pattern but for index files instead). Create a helper `collectIndexFiles(ctx, root)` that finds all `index${ctx.indexExtension}` files.
2. **After writing**: Compare the set of existing index file paths with the set of index file paths that were just written. Delete any index files that exist on disk but weren't in the new index map.
3. **Optionally**: Also delete empty category directories left behind (directories that contain only an `index.yaml` and no memory files). This is debatable — consider adding a warning instead.

The key change in pseudocode:

```typescript
export const reindexCategoryIndexes = async (ctx) => {
    // Collect existing index files BEFORE rebuild
    const existingIndexFiles = await collectIndexFiles(ctx, ctx.storeRoot);

    // Build new state from memory files (existing logic)
    const filesResult = await collectMemoryFiles(ctx, ctx.storeRoot);
    const buildState = await buildIndexState(ctx, filesResult.value);
    applyParentSubcategories(...);

    // Compute which index paths the new state will write
    const newIndexPaths = new Set(
        Array.from(buildState.value.indexes.keys()).map(name =>
            name === '' ? resolve(ctx.storeRoot, `index${ctx.indexExtension}`)
                       : resolve(ctx.storeRoot, name, `index${ctx.indexExtension}`)
        )
    );

    // Write new indexes (existing logic)
    await rebuildIndexFiles(ctx, ctx.storeRoot, buildState.value.indexes);

    // Delete stale index files
    for (const existingPath of existingIndexFiles) {
        if (!newIndexPaths.has(existingPath)) {
            await unlink(existingPath);
        }
    }

    return ok({ warnings: buildState.value.warnings });
};
```

Add `collectIndexFiles` helper:

```typescript
const collectIndexFiles = async (
    ctx: FilesystemContext,
    root: string
): Promise<Result<string[], StorageAdapterError>> => {
    // Similar to collectMemoryFiles but looks for index files
    // Match files named `index${ctx.indexExtension}`
};
```

Import `unlink` (or `rm`) from `node:fs/promises`.

#### Step 1.4: Run the test and confirm it passes

```bash
bun test packages/storage-fs/src/indexes.spec.ts
```

#### Step 1.5: Write additional edge case tests

In the same `indexes.spec.ts` file, add tests for:

- **Reindex with no memory files at all**: All index files should be cleaned up except possibly root
- **Reindex with nested categories**: If `a/b/c/` is empty but `a/b/d/` has memories, only `a/b/c/index.yaml` should be removed
- **Reindex with no stale files**: Nothing extra should be deleted (idempotent)
- **Root index is always preserved**: Even when empty (root `index.yaml` should always exist with `memories: []` and `subcategories: []`)

#### Step 1.6: Run all storage-fs tests

```bash
bun test packages/storage-fs
```

#### Step 1.7: Commit

```
fix(storage-fs): clean up stale index files during reindex
```

---

### Phase 2: Refactor CLI prune to delegate to core

#### Step 2.1: Read existing CLI prune tests

**File:** `packages/cli/src/tests/cli.integration.spec.ts` (line 800+)

Understand what the integration tests cover for prune.

#### Step 2.2: Write a unit test for the refactored handler

**File:** `packages/cli/src/commands/store/prune/command.spec.ts` (new file, or add to existing)

Write a test that validates `handlePrune` delegates to `pruneExpiredMemories` from core. Test:
- Dry-run mode passes through and outputs expected message
- Normal mode deletes and outputs expected message
- Error from core propagates as `CommanderError`

#### Step 2.3: Run the test and confirm it fails

```bash
bun test packages/cli/src/commands/store/prune
```

#### Step 2.4: Refactor `handlePrune` to use core

**File:** `packages/cli/src/commands/store/prune/command.ts`

Replace the ~200 lines of independent implementation with a thin wrapper:

```typescript
import { pruneExpiredMemories } from '@yeseh/cortex-core/memory';
import { parseMemory } from '@yeseh/cortex-storage-fs';

// Create a serializer adapter (parseMemory from storage-fs)
const createSerializer = (): MemorySerializer => ({
    parse: (raw) => parseMemory(raw),
    serialize: (memory) => serializeMemory(memory),
});

export async function handlePrune(
    options: PruneCommandOptions,
    storeName: string | undefined,
    deps: PruneHandlerDeps = {}
): Promise<void> {
    const adapter = deps.adapter ?? (await resolveStoreAdapter(storeName)).value.adapter;
    const serializer = createSerializer();
    const now = deps.now ?? new Date();
    const out = deps.stdout ?? process.stdout;

    const result = await pruneExpiredMemories(adapter, serializer, {
        dryRun: options.dryRun,
        now,
    });

    if (!result.ok) {
        mapCoreError(result.error);
    }

    const pruned = result.value.pruned;
    if (pruned.length === 0) {
        out.write('No expired memories found.\n');
        return;
    }

    const paths = pruned.map((entry) => entry.path).join('\n  ');
    if (options.dryRun) {
        out.write(`Would prune ${pruned.length} expired memories:\n  ${paths}\n`);
    } else {
        out.write(`Pruned ${pruned.length} expired memories:\n  ${paths}\n`);
    }
}
```

Remove the now-unused helpers: `isExpired`, `loadCategoryIndex`, `checkMemoryExpiry`, `collectExpiredFromCategory`, `collectAllExpired`, `deleteExpiredMemories`, `PrunedMemoryEntry`, `PruneError`, local `PruneResult<T>`.

Check how serializers are created elsewhere in the CLI — look at how `parseMemory`/`serializeMemory` are imported. The `PruneHandlerDeps` interface might need a `serializer` field for test injection.

#### Step 2.5: Run CLI prune tests

```bash
bun test packages/cli
```

#### Step 2.6: Run all tests

```bash
bun test packages
```

#### Step 2.7: Commit

```
refactor(cli): delegate prune command to core pruneExpiredMemories
```

---

### Phase 3: Run full validation

#### Step 3.1: Run full test suite

```bash
bun test packages
```

#### Step 3.2: Run type check

```bash
bunx tsc --build
```

#### Step 3.3: Run lint

```bash
bunx eslint packages/*/src/**/*.ts --fix
```

#### Step 3.4: Final commit (if lint made changes)

```
chore: fix lint issues
```

---

## Files Modified

| File | Change |
|------|--------|
| `packages/storage-fs/src/indexes.ts` | Add `collectIndexFiles`, add stale cleanup to `reindexCategoryIndexes` |
| `packages/storage-fs/src/indexes.spec.ts` | **New** — tests for reindex stale cleanup |
| `packages/cli/src/commands/store/prune/command.ts` | Refactor to delegate to core `pruneExpiredMemories` |
| `packages/cli/src/commands/store/prune/command.spec.ts` | **New or updated** — unit tests for refactored handler |

## Files Read-Only (no changes)

| File | Reason |
|------|--------|
| `packages/core/src/memory/operations.ts` | Core prune already calls reindex — no change needed |
| `packages/server/src/memory/tools.ts` | MCP already delegates to core — no change needed |

## Risk Assessment

- **Low risk**: The reindex cleanup is additive — it only deletes files that `rebuildIndexFiles` didn't write. Since reindex already does a full rebuild from disk, the new behavior is strictly more correct.
- **Medium risk**: CLI prune refactor changes behavior for CLI users if there are subtle differences between the core and CLI implementations. Mitigated by running integration tests.
- **Edge case**: If a user has empty category directories with `index.yaml` files intentionally (e.g., seeded categories), reindex will now remove those index files. This seems correct (categories without memories shouldn't have index entries), but worth noting.
