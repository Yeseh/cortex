# Plan: Remove Filesystem Backend Leaks from MCP Server

## Problem

The MCP server package (`packages/server/`) violates the hexagonal architecture by directly
depending on `@yeseh/cortex-storage-fs` and raw `node:fs` in 6 production source files.
The server should be a thin MCP wrapper that depends only on core port interfaces, with the
concrete filesystem adapter injected at the composition root.

## Violations Found

### Critical

| File                 | Line | Issue                                                                                  |
| -------------------- | ---- | -------------------------------------------------------------------------------------- |
| `store/resources.ts` | 22   | Relative import `../../../storage-fs/src/utils.ts` — reaches into FS package internals |

### High — Direct `node:fs` usage (raw filesystem ops in server layer)

| File                 | Lines        | Operations                                     |
| -------------------- | ------------ | ---------------------------------------------- |
| `store/tools.ts`     | 11, 109-129  | `fs.readdir()` to list stores                  |
| `store/tools.ts`     | 151-203      | `fs.stat()` + `fs.mkdir()` to create stores    |
| `store/resources.ts` | 12-13, 61-90 | `fs.readdir(withFileTypes)` to list categories |

### High — `FilesystemRegistry` instantiated in every handler

| File                  | Line        | Function                         |
| --------------------- | ----------- | -------------------------------- |
| `memory/tools.ts`     | 32, 297-331 | `resolveStoreAdapter()` — copy 1 |
| `memory/resources.ts` | 25, 73-107  | `resolveAdapter()` — copy 2      |
| `category/tools.ts`   | 21, 150-179 | `resolveStoreAdapter()` — copy 3 |
| `store/tools.ts`      | 15, 224-255 | `listStoresFromRegistry()`       |
| `health.ts`           | 24, 88-94   | `createHealthRouter()`           |

### Medium — `node:path` for registry path construction (duplicated 5+ times)

```typescript
// This pattern appears in every handler module:
const registryPath = join(config.dataPath, 'stores.yaml');
```

## Root Causes

1. **No dependency injection for `Registry`** — each handler creates its own `FilesystemRegistry`
2. **Missing core operations for store listing/creation** — server reimplements them with raw `fs`
3. **`resolveStoreAdapter` duplicated 3 times** instead of shared
4. **No `ServerContext` abstraction** — handlers receive only `ServerConfig` (a data bag)

## Design

### Introduce `ServerContext` with injected `Registry`

```typescript
// src/context.ts
import type { Registry } from '@yeseh/cortex-core/storage';
import type { ServerConfig } from './config.ts';

export interface ServerContext {
    config: ServerConfig;
    registry: Registry;
}
```

The composition root (`index.ts`) creates the `FilesystemRegistry` once and wraps it in a
`ServerContext`. All `registerXxxTools()` and `registerXxxResources()` functions receive
`ServerContext` instead of `ServerConfig`.

The `Registry` interface is the factory — handlers call `ctx.registry.load()` and
`ctx.registry.getStore()` directly. A thin `resolveStoreAdapter` helper can exist in
`context.ts` for the common load-then-get pattern, but the `Registry` itself is what gets
injected, not the helper.

### Replace raw FS store operations

- `listStores()` -> `registry.load()` then read keys from `StoreRegistry`
- `createStore()` -> `initializeStore()` from `@yeseh/cortex-core`
- `getStoreCategories()` -> `registry.getStore()` then `adapter.indexes.read('')` to get root index

### Remove all `@yeseh/cortex-storage-fs` imports from handler files

After the above changes, `FilesystemRegistry` is only imported in `index.ts` (composition root).
The `store/resources.ts` relative import of `err` is replaced with `@yeseh/cortex-core`.

## Tasks

### Phase 1: Create ServerContext with injected Registry

- [ ] 1.1 Create `src/context.ts` with `ServerContext` interface (holds `config` + `registry`) and a shared `resolveStoreAdapter()` helper
- [ ] 1.2 Update `src/index.ts` to create `FilesystemRegistry` at the composition root, build `ServerContext`, pass it to all registrars
- [ ] 1.3 Update `registerMemoryTools()` signature: `ServerConfig` -> `ServerContext`
- [ ] 1.4 Update `registerCategoryTools()` signature: `ServerConfig` -> `ServerContext`
- [ ] 1.5 Update `registerStoreTools()` signature: `ServerConfig` -> `ServerContext`
- [ ] 1.6 Update `registerStoreResources()` signature: `ServerConfig` -> `ServerContext`
- [ ] 1.7 Update `createHealthRouter()` signature: `ServerConfig` -> `ServerContext`

### Phase 2: Eliminate handler-level FS imports

- [ ] 2.1 `memory/tools.ts` — Remove `FilesystemRegistry` import + inline `resolveStoreAdapter()`, use `ctx.registry` or shared helper from `context.ts`
- [ ] 2.2 `memory/resources.ts` — Remove `FilesystemRegistry` import + inline `resolveAdapter()`, use `ctx.registry` or shared helper
- [ ] 2.3 `category/tools.ts` — Remove `FilesystemRegistry` import + inline `resolveStoreAdapter()`, use `ctx.registry` or shared helper
- [ ] 2.4 `health.ts` — Remove `FilesystemRegistry` import, use `ctx.registry.load()` directly
- [ ] 2.5 Remove `node:path` imports from handler files where only used for registry path construction

### Phase 3: Replace raw FS store operations

- [ ] 3.1 `store/tools.ts` — Replace `listStores()` (raw `fs.readdir`) with `registry.load()` reading store names
- [ ] 3.2 `store/tools.ts` — Replace `createStore()` (raw `fs.stat`/`fs.mkdir`) with `initializeStore()` from core
- [ ] 3.3 `store/resources.ts` — Replace `getStoreCategories()` (raw `fs.readdir`) with index-based lookup via `adapter.indexes.read('')`
- [ ] 3.4 `store/resources.ts` — Fix critical relative import: `../../../storage-fs/src/utils.ts` -> `@yeseh/cortex-core`
- [ ] 3.5 Remove `node:fs/promises` imports from `store/tools.ts` and `store/resources.ts`

### Phase 4: Cleanup and verify

- [ ] 4.1 Remove `@yeseh/cortex-storage-fs` from all files except `src/index.ts`
- [ ] 4.2 Verify no `node:fs` imports remain in server package (except composition root if needed)
- [ ] 4.3 Update tests to inject mock `Registry` instead of `FilesystemRegistry`
- [ ] 4.4 Run `bun test packages/server` — all tests pass
- [ ] 4.5 Run `bunx tsc --build` — no type errors
- [ ] 4.6 Run `bunx eslint packages/server/src/**/*.ts --fix` — no lint errors

## Out of Scope

- Refactoring `core/store/operations/initialize.ts` (it uses `node:fs` for `mkdir` but that's
  a core concern, not a server boundary issue — tracked separately)
- Changing the `Registry` interface in core
- Refactoring tests to not use `FilesystemStorageAdapter` (integration tests legitimately need the real adapter)

## Expected Outcome

After this work:

- `packages/server/src/` has **zero** imports from `@yeseh/cortex-storage-fs` except in `index.ts`
- `packages/server/src/` has **zero** `node:fs` imports in handler files
- All store operations go through core abstractions (`Registry`, `initializeStore`, `ScopedStorageAdapter`)
- The `resolveStoreAdapter` pattern exists in exactly one place
- The server could theoretically work with a non-filesystem backend by swapping the `Registry` implementation at the composition root
