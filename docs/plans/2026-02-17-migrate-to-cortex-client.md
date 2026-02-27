# Migrate to Cortex Client Implementation Plan

**Goal:** Consolidate all FilesystemRegistry usage to the new Cortex API for consistent dependency injection
**Architecture:** Add CortexContext interface in core, migrate CLI and MCP server handlers to receive context as first parameter, remove FilesystemRegistry class
**Tech Stack:** TypeScript, Bun, Commander.js (CLI), MCP SDK (server)
**Session Id:** migrate-to-cortex-client

---

## Phase 1: Core Changes

### Task 1.1: Define CortexContext interface in core
**File:** `packages/core/src/cortex/types.ts`
**Action:** Add `CortexContext` interface

```typescript
/**
 * Context object for dependency injection into handlers.
 * Provides access to the Cortex client for store operations.
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
}
```

### Task 1.2: Export CortexContext from core package
**File:** `packages/core/src/cortex/index.ts`
**Action:** Add export for `CortexContext`

```typescript
export type { CortexContext } from './types.ts';
```

---

## Phase 2: CLI Migration

### Task 2.1: Create Cortex factory in CLI
**File:** `packages/cli/src/cortex.ts` (new file)
**Action:** Create factory function for CLI Cortex instance

```typescript
import { Cortex, type CortexOptions } from '@yeseh/cortex-core';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';

/**
 * Creates an adapter factory that uses FilesystemStorageAdapter.
 */
const createFilesystemAdapterFactory = () => {
    return (storePath: string): ScopedStorageAdapter => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storePath });
        return {
            memories: adapter.memories,
            indexes: adapter.indexes,
            categories: adapter.categories,
        };
    };
};

/**
 * Creates a Cortex instance configured for CLI usage.
 * Loads configuration from the specified directory.
 */
export const createCliCortex = async (configDir: string): Promise<Cortex> => {
    const result = await Cortex.fromConfig(configDir);
    if (result.ok()) {
        return result.value;
    }
    // Fall back to minimal init if no config exists
    return Cortex.init({
        rootDirectory: configDir,
        adapterFactory: createFilesystemAdapterFactory(),
    });
};
```

### Task 2.2: Refactor context.ts to use Cortex
**File:** `packages/cli/src/context.ts`
**Action:** Replace FilesystemRegistry with Cortex-based resolution

- Remove `FilesystemRegistry` imports
- Add `Cortex` import from core
- Update `resolveStoreAdapter` to use `Cortex.getStore()`
- Keep backward-compatible function signatures

### Task 2.3-2.9: Update CLI command handlers
**Files:** All handlers in `packages/cli/src/commands/memory/` and `packages/cli/src/commands/store/`
**Action:** Handler signatures remain the same (context resolved internally), but use new resolution

The handlers already use `resolveStoreAdapter` from context.ts, so once context.ts is updated, handlers will automatically use Cortex.

### Task 2.10: Update handleInit
**File:** `packages/cli/src/commands/init/command.ts`
**Action:** Use `Cortex.init()` and `cortex.initialize()` instead of direct FilesystemRegistry

---

## Phase 3: MCP Server Migration

### Task 3.1: Create Cortex instance at server startup
**File:** `packages/server/src/index.ts`
**Action:** Create Cortex instance and pass to context

```typescript
// In createServer():
const cortex = await createServerCortex(config);
const toolContext: ToolContext = { config, cortex };
```

### Task 3.2: Update ToolContext interface
**File:** `packages/server/src/memory/tools/shared.ts`
**Action:** Add `cortex` to ToolContext

```typescript
import type { Cortex } from '@yeseh/cortex-core';

export interface ToolContext {
    config: ServerConfig;
    cortex: Cortex;
}
```

### Task 3.3: Update resolveStoreAdapter in shared.ts
**Action:** Use `ctx.cortex.getStore()` instead of FilesystemRegistry

```typescript
export const resolveStoreAdapter = (
    ctx: ToolContext,
    storeName: string,
): Result<ScopedStorageAdapter, McpError> => {
    const storeResult = ctx.cortex.getStore(storeName);
    if (!storeResult.ok()) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }
    return ok(storeResult.value);
};
```

### Task 3.4-3.7: Update tool handlers
**Files:** All handlers in `packages/server/src/memory/tools/`, `store/`, `category/`
**Action:** Handlers already use `resolveStoreAdapter` from shared.ts, so once shared.ts is updated, they will automatically use Cortex.

### Task 3.8: Remove FilesystemRegistry from server
**Action:** Remove all FilesystemRegistry imports after migration complete

---

## Phase 4: Cleanup

### Task 4.1: Remove FilesystemRegistry class
**File:** `packages/storage-fs/src/filesystem-registry.ts`
**Action:** Delete file after all usages migrated

### Task 4.2: Update storage-fs exports
**File:** `packages/storage-fs/src/index.ts`
**Action:** Remove `FilesystemRegistry` export

---

## Phase 5: Validation

### Task 5.1: Run all tests
```bash
bun test
```

### Task 5.2: Run lint and typecheck
```bash
bunx eslint packages/*/src/**/*.ts --fix
bunx tsc --build
```

---

## Dependency Graph

```
Phase 1 (Core)
├── Task 1.1 → Task 1.2 (sequential)
│
Phase 2 (CLI) - depends on Phase 1
├── Task 2.1 → Task 2.2 (sequential)
├── Tasks 2.3-2.11 (parallel after 2.2)
├── Task 2.12 (after handlers done)
│
Phase 3 (Server) - depends on Phase 1
├── Task 3.1 → Task 3.2 → Task 3.3 (sequential)
├── Tasks 3.4-3.8 (parallel after 3.3)
├── Task 3.9 (after handlers done)
│
Phase 4 (Cleanup) - depends on Phase 2+3
├── Task 4.1 → Task 4.2 (sequential)
│
Phase 5 (Validation) - depends on Phase 4
└── Task 5.1 → Task 5.2 → Task 5.3 (sequential)
```

## Parallelization Strategy

1. Phase 1 (Core) must complete first
2. Phase 2 (CLI) and Phase 3 (Server) can run in parallel after Phase 1
3. Phase 4 (Cleanup) after both CLI and Server migrations complete
4. Phase 5 (Validation) is the final sequential phase
