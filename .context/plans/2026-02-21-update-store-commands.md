# Update Store Commands to New Standard - Implementation Plan

**Goal:** Migrate all CLI store commands (`list`, `add`, `remove`, `prune`, `reindex`) to use the `CortexContext` + `Cortex.getStore()` pattern, matching the memory commands that already follow this standard.

**Architecture:** Store commands currently use the old pattern with `FilesystemRegistry`, `loadRegistry()`, and `resolveStoreAdapter()` which have been removed from `context.ts`. The new pattern uses `CortexContext` as the first handler parameter, `createCliCommandContext()` in the action, and `ctx.cortex.getStore()` for store operations.

**Tech Stack:** TypeScript, Commander.js, Bun test framework

**Session Id:** update-store-commands-2026-02-21

---

## Current State Analysis

### Old Pattern (store commands):

```typescript
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { loadRegistry, resolveStoreAdapter } from '../../context.ts';

export async function handleList(
    options: ListCommandOptions,
    deps: ListHandlerDeps = {}
): Promise<void> {
    const registryResult = await loadRegistry();
    // ... use registry directly
}

export const listCommand = new Command('list').action(async (options) => {
    await handleList(options);
});
```

### New Pattern (memory commands):

```typescript
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

export async function handleShow(
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: ShowCommandOptions,
    deps: ShowHandlerDeps = {}
): Promise<void> {
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    // ... use store client
}

export const showCommand = new Command('show').action(async (path, options, command) => {
    const parentOpts = command.parent?.opts() as { store?: string } | undefined;
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleShow(context.value, parentOpts?.store, path, options);
});
```

---

## Files to Update

### 1. `packages/cli/src/store/commands/list.ts`

**Changes:**

- Add `ctx: CortexContext` as first parameter to `handleList`
- Remove `loadRegistry()` import
- Add `createCliCommandContext()` import
- Use `ctx.stores` (from CortexContext) instead of `loadRegistry()`
- Update command action to create context and pass to handler

**Code Template:**

```typescript
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

export async function handleList(
    ctx: CortexContext,
    options: ListCommandOptions,
    deps: ListHandlerDeps = {}
): Promise<void> {
    // Use ctx.stores directly from the context
    const stores = Object.entries(ctx.stores)
        .map(([name, def]) => ({ name, path: def.path }))
        .sort((a, b) => a.name.localeCompare(b.name));
    // ... rest of implementation
}

export const listCommand = new Command('list').action(async (options) => {
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleList(context.value, options);
});
```

---

### 2. `packages/cli/src/store/commands/add.ts`

**Changes:**

- Add `ctx: CortexContext` as first parameter to `handleAdd`
- Remove `FilesystemRegistry` import and direct usage
- Add `createCliCommandContext()` import
- Use `ctx.cortex.getStore(name).save()` for adding stores
- Note: Adding stores requires writing to config file - may need to add mutation methods to Cortex (per `todo/add-cortex-mutation-methods`)

**Temporary Solution:**
For now, the add command can still use `FilesystemRegistry` internally but should receive `CortexContext`. The full migration to Cortex mutation methods is a separate follow-up task.

**Code Template:**

```typescript
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext, getDefaultConfigPath } from '../../create-cli-command.ts';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';

export async function handleAdd(
    ctx: CortexContext,
    name: string,
    storePath: string,
    options: AddCommandOptions = {},
    deps: AddHandlerDeps = {}
): Promise<void> {
    const cwd = deps.cwd ?? process.cwd();
    const stdout = ctx.stdout ?? process.stdout;
    // ... validate inputs

    // TODO: Use ctx.cortex.addStore() when mutation methods are added
    // For now, continue using FilesystemRegistry for store mutations
    const registryPath = getDefaultConfigPath();
    const registry = new FilesystemRegistry(registryPath);
    // ... rest of implementation
}

export const addCommand = new Command('add').action(async (name, path, options) => {
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleAdd(context.value, name, path, options);
});
```

---

### 3. `packages/cli/src/store/commands/remove.ts`

**Changes:**

- Add `ctx: CortexContext` as first parameter to `handleRemove`
- Remove `FilesystemRegistry` import usage where possible
- Add `createCliCommandContext()` import
- Same temporary solution as `add.ts` for mutations

**Code Template:**

```typescript
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

export async function handleRemove(
    ctx: CortexContext,
    name: string,
    options: RemoveCommandOptions = {},
    deps: RemoveHandlerDeps = {}
): Promise<void> {
    const stdout = ctx.stdout ?? process.stdout;
    // ... implementation
}

export const removeCommand = new Command('remove').action(async (name, options) => {
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleRemove(context.value, name, options);
});
```

---

### 4. `packages/cli/src/store/commands/prune.ts`

**Changes:**

- Add `ctx: CortexContext` as first parameter to `handlePrune`
- Remove `resolveStoreAdapter()` import (function no longer exists)
- Add `createCliCommandContext()` import
- Use `ctx.cortex.getStore(storeName)` instead of `resolveStoreAdapter()`
- Get adapter from store client's internal adapter

**Code Template:**

```typescript
import { type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

export async function handlePrune(
    ctx: CortexContext,
    storeName: string | undefined,
    options: PruneCommandOptions,
    deps: PruneHandlerDeps = {}
): Promise<void> {
    const now = ctx.now() ?? new Date();
    const stdout = ctx.stdout ?? process.stdout;

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    // Call prune on the category
    const result = await rootResult.value.prune({ dryRun: options.dryRun, now });
    // ... format output
}

export const pruneCommand = new Command('prune').action(async (options, command) => {
    const parentOpts = command.parent?.opts() as { store?: string } | undefined;
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handlePrune(context.value, parentOpts?.store, options);
});
```

---

### 5. `packages/cli/src/store/commands/reindexs.ts` (rename to `reindex.ts`)

**Changes:**

- Add `ctx: CortexContext` as first parameter to `handleReindex`
- Remove `resolveStoreAdapter()` import
- Add `createCliCommandContext()` import
- Use `ctx.cortex.getStore(storeName)` instead of `resolveStoreAdapter()`
- Fix typo in filename (`reindexs.ts` → `reindex.ts`)

**Code Template:**

```typescript
import { type CortexContext, CategoryPath } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

export async function handleReindex(
    ctx: CortexContext,
    storeName: string | undefined,
    deps: ReindexHandlerDeps = {}
): Promise<void> {
    const stdout = ctx.stdout ?? process.stdout;

    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const store = storeResult.value;
    const rootResult = store.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const reindexResult = await rootResult.value.reindex();
    // ... format output
}

export const reindexCommand = new Command('reindex').action(async (_options, command) => {
    const parentOpts = command.parent?.opts() as { store?: string } | undefined;
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleReindex(context.value, parentOpts?.store);
});
```

---

### 6. `packages/cli/src/context.spec.ts`

**Changes:**

- Remove tests for `loadRegistry()` - function no longer exists
- Remove tests for `resolveStoreContext()` - function no longer exists
- Keep tests for `getDefaultGlobalStorePath()` and `getDefaultConfigPath()`

---

### 7. `packages/cli/src/store/index.ts`

**Changes:**

- Update import from `reindexs.ts` to `reindex.ts` (if renaming)

---

## Test Strategy

1. All existing tests that don't depend on removed functions should pass
2. Tests in `context.spec.ts` for removed functions should be removed
3. Handler tests should be updated to pass `CortexContext` as first parameter
4. Use `createTestContext()` pattern from memory command tests

---

## Dependencies

- The `init.ts` command already follows the new pattern - use as reference
- Memory commands (`add.ts`, `show.ts`, etc.) already follow the new pattern

---

## Blocking Issues

The `add` and `remove` commands need to mutate the store registry. Currently `Cortex` is read-only after initialization. Two options:

1. **Temporary:** Continue using `FilesystemRegistry` directly for mutations within the handlers
2. **Full migration:** Wait for `todo/add-cortex-mutation-methods` to add `Cortex.addStore()` and `Cortex.removeStore()`

This plan uses option 1 (temporary) to unblock the migration, with the full migration as future work.

---

## Verification Checklist

- [ ] All store commands use `CortexContext` as first handler parameter
- [ ] All command actions call `createCliCommandContext()`
- [ ] No imports of `loadRegistry` or `resolveStoreAdapter`
- [ ] `context.ts` only exports `getDefaultGlobalStorePath` and `getDefaultConfigPath`
- [ ] All tests pass
- [ ] Typo in `reindexs.ts` filename is fixed
