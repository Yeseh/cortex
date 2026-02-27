# Storage Abstraction Refactoring Implementation Plan (v2 - Registry Pattern)

**Goal:** Abstract storage adapter creation from CLI and Server through the Registry interface for dependency injection
**Architecture:** Registry pattern with `getStore()` returning `ScopedStorageAdapter`; `FilesystemRegistry` is already implemented, CLI needs to use it instead of direct `FilesystemStorageAdapter` instantiation
**Tech Stack:** TypeScript, Bun, Zod validation
**Session Id:** ses_3eba3e835ffek2PDs0FbzirwB3

---

## Overview

The main branch now has a `Registry` interface with `getStore(name)` returning `ScopedStorageAdapter`. The MCP server partially uses this pattern. This refactoring will:

1. Complete the server migration to use `Registry.getStore()` fully
2. Update CLI commands to use `Registry.getStore()` instead of direct `FilesystemStorageAdapter` instantiation
3. Enable future storage backends by depending only on the `Registry` interface

## Current State

**Already done (in main):**

- `Registry` interface defined in `src/core/storage/adapter.ts` (lines 564-649)
- `ScopedStorageAdapter` interface defined (lines 515-522)
- `FilesystemRegistry` implemented in `src/core/storage/filesystem/filesystem-registry.ts`
- Server uses `FilesystemRegistry` in `resolveStoreAdapter` but still creates `FilesystemStorageAdapter` directly

**Needs updating:**

- CLI commands use direct `FilesystemStorageAdapter` instantiation (6 memory commands + 2 store commands)
- Server should use `registry.getStore()` instead of creating adapter directly

## Task Breakdown

### Phase 1: Update CLI Context for Registry Support

#### 1.1 Add resolveStoreAdapter function to CLI context (Implementation)

**File:** `src/cli/context.ts`
**Action:** Add a function that returns both context AND a `ScopedStorageAdapter`

```typescript
import type { Registry, ScopedStorageAdapter } from '../core/storage/adapter.ts';

export interface ResolvedStore {
    context: StoreContext;
    adapter: ScopedStorageAdapter;
}

/**
 * Resolves store context and returns a scoped storage adapter.
 *
 * Uses the Registry pattern to get a storage adapter scoped to the resolved store.
 *
 * @param storeName - Optional store name to look up in the registry
 * @param options - Resolution options
 * @returns Result with resolved store and adapter, or error
 */
export const resolveStoreAdapter = async (
    storeName: string | undefined,
    options: StoreContextOptions = {}
): Promise<Result<ResolvedStore, StoreContextError>> => {
    const registryPath = options.registryPath ?? getDefaultRegistryPath();
    const registry = new FilesystemRegistry(registryPath);

    // Load registry first
    const registryResult = await registry.load();

    // If storeName provided, get from registry
    if (storeName) {
        if (!registryResult.ok) {
            return err({
                code: 'REGISTRY_LOAD_FAILED',
                message: `Failed to load store registry: ${registryResult.error.message}`,
                cause: registryResult.error,
            });
        }

        const adapterResult = registry.getStore(storeName);
        if (!adapterResult.ok) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: adapterResult.error.message,
            });
        }

        const pathResult = resolveStorePath(registryResult.value, storeName);
        return ok({
            context: {
                root: pathResult.ok ? pathResult.value : '',
                name: storeName,
                scope: 'registry',
            },
            adapter: adapterResult.value,
        });
    }

    // Default resolution - use existing resolveStoreContext then create adapter
    const contextResult = await resolveStoreContext(storeName, options);
    if (!contextResult.ok) {
        return err(contextResult.error);
    }

    // For local/global stores, create adapter directly
    // (these aren't in the registry)
    const { FilesystemStorageAdapter } = await import('../core/storage/filesystem/index.ts');
    const fsAdapter = new FilesystemStorageAdapter({ rootDirectory: contextResult.value.root });

    return ok({
        context: contextResult.value,
        adapter: {
            memories: fsAdapter.memories,
            indexes: fsAdapter.indexes,
            categories: fsAdapter.categories,
        },
    });
};
```

### Phase 2: Update CLI Memory Commands

Each command follows the same pattern:

1. Remove `FilesystemStorageAdapter` import
2. Import `ScopedStorageAdapter` type from core
3. Change `resolveStoreContext` to `resolveStoreAdapter`
4. Use `result.value.adapter` instead of creating new adapter
5. Update handler deps interface to accept optional `ScopedStorageAdapter`

#### 2.1 Update memory add command (Implementation)

**File:** `src/cli/commands/memory/add/command.ts`

**Changes:**

```typescript
// REMOVE: import { FilesystemStorageAdapter } from '../../../../core/storage/filesystem/index.ts';
// ADD:
import type { ScopedStorageAdapter } from '../../../../core/storage/adapter.ts';
import { resolveStoreAdapter } from '../../../context.ts';

export interface AddHandlerDeps {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    now?: Date;
    /** Pre-resolved adapter for testing */
    adapter?: ScopedStorageAdapter;
}

// In handleAdd:
// Change: const contextResult = await resolveStoreContext(storeName);
// To: const storeResult = await resolveStoreAdapter(storeName);

// Then use adapter from deps or resolved:
const adapter = deps.adapter ?? storeResult.value.adapter;

// Use adapter.memories.write() instead of adapter.writeMemoryFile()
const writeResult = await adapter.memories.write(pathResult.value.slugPath, serialized.value);

// If index update needed, use adapter.indexes.updateAfterMemoryWrite()
```

#### 2.2 Update memory remove command (Implementation)

**File:** `src/cli/commands/memory/remove/command.ts`
**Pattern:** Same as 2.1

#### 2.3 Update memory list command (Implementation)

**File:** `src/cli/commands/memory/list/command.ts`
**Pattern:** Same as 2.1, but this one has helper functions that accept adapter

#### 2.4 Update memory show command (Implementation)

**File:** `src/cli/commands/memory/show/command.ts`
**Pattern:** Same as 2.1

#### 2.5 Update memory move command (Implementation)

**File:** `src/cli/commands/memory/move/command.ts`
**Pattern:** Same as 2.1

#### 2.6 Update memory update command (Implementation)

**File:** `src/cli/commands/memory/update/command.ts`
**Pattern:** Same as 2.1

### Phase 3: Update CLI Store Commands

#### 3.1 Update store reindex command (Implementation)

**File:** `src/cli/commands/store/reindex/command.ts`
**Pattern:** Same as Phase 2

#### 3.2 Update store prune command (Implementation)

**File:** `src/cli/commands/store/prune/command.ts`
**Pattern:** Same as Phase 2

### Phase 4: Update MCP Server to Use Registry Fully

The server already uses `FilesystemRegistry` but still creates `FilesystemStorageAdapter` directly. Update to use `registry.getStore()`.

#### 4.1 Update resolveStoreAdapter in memory/tools.ts (Implementation)

**File:** `src/server/memory/tools.ts`

**Current code (lines 194-247):**

```typescript
const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<FilesystemStorageAdapter, McpError>> => {
    // ... loads registry, resolves path, creates FilesystemStorageAdapter
};
```

**Updated code:**

```typescript
import type { ScopedStorageAdapter } from '../../core/storage/adapter.ts';

const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();

    if (!registryResult.ok) {
        if (registryResult.error.code === 'REGISTRY_MISSING') {
            return err(
                new McpError(ErrorCode.InternalError, `Store registry not found at ${registryPath}`)
            );
        }
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to load store registry: ${registryResult.error.message}`
            )
        );
    }

    // Use registry.getStore() instead of creating adapter directly
    const storeResult = registry.getStore(storeName);
    if (!storeResult.ok) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }

    // Handle autoCreate if needed (for directory creation)
    if (autoCreate) {
        const storePathResult = resolveStorePath(registryResult.value, storeName);
        if (storePathResult.ok) {
            try {
                await mkdir(storePathResult.value, { recursive: true });
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                return err(
                    new McpError(
                        ErrorCode.InternalError,
                        `Failed to create store directory '${storeName}': ${message}`
                    )
                );
            }
        }
    }

    return ok(storeResult.value);
};
```

#### 4.2 Update tool handlers to use ScopedStorageAdapter (Implementation)

**File:** `src/server/memory/tools.ts`

Update all tool handlers that use `adapter.writeMemoryFile()`, `adapter.readMemoryFile()` etc. to use:

- `adapter.memories.read()`
- `adapter.memories.write()`
- `adapter.memories.remove()`
- `adapter.memories.move()`
- `adapter.indexes.reindex()`
- etc.

#### 4.3 Update category/tools.ts (Implementation)

**File:** `src/server/category/tools.ts`

Same pattern - use `registry.getStore()` and `ScopedStorageAdapter`.

### Phase 5: Validation

#### 5.1 Verify no direct FilesystemStorageAdapter in CLI/Server (Validation)

```bash
rg "new FilesystemStorageAdapter" src/cli src/server
# Should only find in context.ts for local/global store fallback
```

#### 5.2 Run tests (Validation)

```bash
bun test
```

#### 5.3 Manual CLI testing (Validation)

```bash
# Test memory commands
cortex memory add test/registry-pattern --content "Testing"
cortex memory show test/registry-pattern
cortex memory list test
cortex memory remove test/registry-pattern
```

#### 5.4 Test MCP server (Validation)

```bash
bun run src/server/index.ts
# Verify it starts without errors
```

## Dependency Map

```
Phase 1 (CLI Context)
    └── Phase 2 (CLI Memory Commands) - all parallelizable
            ├── 2.1 add
            ├── 2.2 remove
            ├── 2.3 list
            ├── 2.4 show
            ├── 2.5 move
            └── 2.6 update
    └── Phase 3 (CLI Store Commands) - parallelizable with Phase 2
            ├── 3.1 reindex
            └── 3.2 prune

Phase 4 (Server Updates) - can run parallel to Phase 2/3
    ├── 4.1 memory/tools resolveStoreAdapter
    ├── 4.2 memory/tools handlers
    └── 4.3 category/tools

Phase 5 (Validation) - after all others
```

## Files Modified

### CLI Changes

- `src/cli/context.ts` - Add `resolveStoreAdapter` function
- `src/cli/commands/memory/add/command.ts`
- `src/cli/commands/memory/remove/command.ts`
- `src/cli/commands/memory/list/command.ts`
- `src/cli/commands/memory/show/command.ts`
- `src/cli/commands/memory/move/command.ts`
- `src/cli/commands/memory/update/command.ts`
- `src/cli/commands/store/reindex/command.ts`
- `src/cli/commands/store/prune/command.ts`

### Server Changes

- `src/server/memory/tools.ts`
- `src/server/category/tools.ts`

## Notes

- The `FilesystemRegistry.getStore()` internally creates a `FilesystemStorageAdapter` and returns a `ScopedStorageAdapter` - this is the correct encapsulation
- CLI local/global stores (not in registry) still need to create adapter directly, but this is isolated to `context.ts`
- The `ScopedStorageAdapter` interface only has `memories`, `indexes`, `categories` - not `stores` (that's registry-level)
