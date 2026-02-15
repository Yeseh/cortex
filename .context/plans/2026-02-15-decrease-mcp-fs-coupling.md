# MCP Server FS Decoupling Implementation Plan

**Goal:** Remove direct filesystem dependencies from the MCP server package by introducing a registry factory interface that enables dependency injection
**Architecture:** Inversion of control via a `RegistryFactory` interface in core, with the concrete `FilesystemRegistry` implementation injected at server startup
**Tech Stack:** TypeScript, Bun, ports and adapters architecture
**Session Id:** ses_39e6d685dffecxBpMGOIZGl8Qa

---

## Problem Analysis

The MCP server (`packages/server`) currently has 10 direct imports from `@yeseh/cortex-storage-fs`:

1. `health.ts` - `FilesystemRegistry` for store counting
2. `store/tools.ts` - `FilesystemRegistry` for listing stores
3. `store/index.ts` - `FilesystemRegistry` for creating stores
4. `memory/tools/shared.ts` - `FilesystemRegistry` for resolving store adapters
5. `memory/resources.ts` - `FilesystemRegistry` for resource listing
6. `category/tools.ts` - `FilesystemRegistry` for category operations
7. `memory/tools/test-utils.ts` - `FilesystemStorageAdapter` (test file)
8. `memory/tools/list-memories.spec.ts` - `FilesystemStorageAdapter` (test file)
9. `memory/resources.spec.ts` - `FilesystemStorageAdapter` (test file)
10. `memory/debug-index.spec.ts` - `FilesystemStorageAdapter` (test file)

The coupling pattern is consistent: each module creates a new `FilesystemRegistry` instance with a hardcoded path construction:

```typescript
const registryPath = join(config.dataPath, 'stores.yaml');
const registry = new FilesystemRegistry(registryPath);
```

## Solution Design

### Approach: Registry Factory Injection

Instead of modifying the `Registry` interface (which would affect the entire codebase), we introduce a `RegistryFactory` function type that the server receives at startup. This factory returns a `Registry` instance, allowing:

1. **Production**: Factory returns `FilesystemRegistry`
2. **Testing**: Factory returns a mock `Registry` implementation

### Key Benefits

1. **No changes to core interfaces** - The `Registry` interface stays the same
2. **Minimal blast radius** - Only server package changes
3. **Better testability** - Tests can inject mock registries
4. **Future flexibility** - Easy to add other backends (SQLite, Redis, etc.)

---

## Task Breakdown

### Phase 1: Define Factory Type (core package)

#### Task 1.1: Add RegistryFactory type to storage/adapter.ts

**File:** `packages/core/src/storage/adapter.ts`

Add at the end of the file:

````typescript
/**
 * Factory function that creates a Registry instance.
 *
 * Used for dependency injection in server startup to decouple
 * the server from specific storage implementations.
 *
 * @param registryPath - Path to the registry file
 * @returns A Registry instance configured for that path
 *
 * @example
 * ```typescript
 * // Production: use FilesystemRegistry
 * const factory: RegistryFactory = (path) => new FilesystemRegistry(path);
 *
 * // Testing: use mock registry
 * const factory: RegistryFactory = () => mockRegistry;
 * ```
 */
export type RegistryFactory = (registryPath: string) => Registry;
````

#### Task 1.2: Export RegistryFactory from storage index

**File:** `packages/core/src/storage/index.ts` (if exists) or barrel export

---

### Phase 2: Update Server Configuration

#### Task 2.1: Add registryFactory to ServerConfig

**File:** `packages/server/src/config.ts`

Add to the config type (not the Zod schema, since it's a runtime dependency):

```typescript
/**
 * Runtime dependencies for the server.
 * These are not loaded from environment variables.
 */
export interface ServerDependencies {
    /**
     * Factory function to create Registry instances.
     * Defaults to FilesystemRegistry if not provided.
     */
    registryFactory?: RegistryFactory;
}
```

#### Task 2.2: Update createServer to accept dependencies

**File:** `packages/server/src/index.ts`

```typescript
export const createServer = async (
    deps: ServerDependencies = {}
): Promise<Result<CortexServer, ServerStartError>> => {
    // Default to FilesystemRegistry if no factory provided
    const registryFactory =
        deps.registryFactory ?? ((path: string) => new FilesystemRegistry(path));

    // Pass factory to tool registration
    registerMemoryTools(mcpServer, config, registryFactory);
    // ...
};
```

---

### Phase 3: Update Tool Registration to Use Factory

#### Task 3.1: Update shared.ts resolveStoreAdapter

**File:** `packages/server/src/memory/tools/shared.ts`

Change from:

```typescript
export const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    // ...
};
```

To:

```typescript
export const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
    registryFactory: RegistryFactory
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registry = registryFactory(registryPath);
    // ...
};
```

#### Task 3.2: Update ToolContext to include factory

**File:** `packages/server/src/memory/tools/shared.ts`

```typescript
export interface ToolContext {
    config: ServerConfig;
    registryFactory: RegistryFactory;
}
```

#### Task 3.3: Update all memory tool handlers

**Files:** All files in `packages/server/src/memory/tools/`

Update each handler to pass `ctx.registryFactory` to `resolveStoreAdapter`.

#### Task 3.4: Update registerMemoryTools

**File:** `packages/server/src/memory/tools/index.ts`

```typescript
export const registerMemoryTools = (
    server: McpServer,
    config: ServerConfig,
    registryFactory: RegistryFactory
): void => {
    const ctx: ToolContext = { config, registryFactory };
    // ...
};
```

#### Task 3.5: Update category/tools.ts

**File:** `packages/server/src/category/tools.ts`

Same pattern - add `registryFactory` parameter and pass through context.

#### Task 3.6: Update store/index.ts

**File:** `packages/server/src/store/index.ts`

Same pattern for `registerStoreTools`.

#### Task 3.7: Update store/tools.ts

**File:** `packages/server/src/store/tools.ts`

Update `listStoresFromRegistry` to accept `RegistryFactory`:

```typescript
export const listStoresFromRegistry = async (
    registryPath: string,
    registryFactory: RegistryFactory
): Promise<Result<ListStoresResult, StoreToolError>> => {
    const registry = registryFactory(registryPath);
    // ...
};
```

#### Task 3.8: Update health.ts

**File:** `packages/server/src/health.ts`

Either:

1. Accept `registryFactory` as parameter, OR
2. Accept the registry/store count directly (simpler for health checks)

Option 2 is cleaner since health doesn't need the full factory:

```typescript
export const createHealthResponse = async (
    config: ServerConfig,
    storeCount: number
): Promise<Response> => {
    // ...
};
```

#### Task 3.9: Update memory/resources.ts

**File:** `packages/server/src/memory/resources.ts`

Same pattern - pass factory to resource handlers.

---

### Phase 4: Update Tests

#### Task 4.1: Create mock registry helper

**File:** `packages/server/src/test-utils.ts` (new file)

```typescript
import type { Registry, ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { ok, err } from '@yeseh/cortex-core';

export const createMockRegistry = (
    stores: Record<string, ScopedStorageAdapter> = {}
): Registry => ({
    initialize: async () => ok(undefined),
    load: async () =>
        ok(
            Object.fromEntries(Object.keys(stores).map((name) => [name, { path: `/mock/${name}` }]))
        ),
    save: async () => ok(undefined),
    getStore: (name) => {
        const adapter = stores[name];
        if (!adapter) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${name}' not found`,
                store: name,
            });
        }
        return ok(adapter);
    },
});

export const createMockRegistryFactory =
    (stores: Record<string, ScopedStorageAdapter> = {}): RegistryFactory =>
    () =>
        createMockRegistry(stores);
```

#### Task 4.2: Update existing test files to use mock factory

Update test files that currently import `FilesystemStorageAdapter` directly to use the mock factory instead where appropriate.

---

### Phase 5: Remove Direct storage-fs Imports

After all changes, the server package should have:

- **Zero production imports** from `@yeseh/cortex-storage-fs`
- Only the main entry point (`index.ts`) imports it to create the default factory
- Test files may still use `FilesystemStorageAdapter` for integration tests

---

## Dependency Map

```
Phase 1 (Core) → Phase 2 (Config) → Phase 3 (Tools) → Phase 4 (Tests) → Phase 5 (Cleanup)

Parallelizable within phases:
- Phase 3 tasks 3.3-3.9 can run in parallel after 3.1-3.2
- Phase 4 tasks can run in parallel
```

---

## Files to Modify

### Core Package (1 file)

- `packages/core/src/storage/adapter.ts` - Add RegistryFactory type

### Server Package (12 files)

- `packages/server/src/config.ts` - Add ServerDependencies interface
- `packages/server/src/index.ts` - Accept dependencies, create default factory
- `packages/server/src/health.ts` - Remove FilesystemRegistry import
- `packages/server/src/memory/tools/shared.ts` - Update ToolContext and resolveStoreAdapter
- `packages/server/src/memory/tools/index.ts` - Pass factory through registration
- `packages/server/src/memory/tools/*.ts` - Update handlers to use ctx.registryFactory
- `packages/server/src/memory/resources.ts` - Update to use factory
- `packages/server/src/store/index.ts` - Update registerStoreTools
- `packages/server/src/store/tools.ts` - Update listStoresFromRegistry
- `packages/server/src/category/tools.ts` - Update tool handlers

### New Files

- `packages/server/src/test-utils.ts` - Mock registry factory

---

## Verification

1. Run `bun test packages/server` - All 251 tests must pass
2. Run `bun typecheck` - No type errors
3. Run `bunx eslint packages/server/src/**/*.ts --fix` - Clean lint
4. Manual test: Start server and verify MCP tools work

---

## Breaking Changes

**None** - This is a pure internal refactor. The external API (MCP tools, health endpoint) remains unchanged.

---

## Estimated Effort

- Phase 1: 10 minutes
- Phase 2: 15 minutes
- Phase 3: 45 minutes (most work)
- Phase 4: 30 minutes
- Phase 5: 5 minutes (verification)

**Total:** ~2 hours
