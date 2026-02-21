# MCP Server CortexContext Refactor Implementation Plan

**Goal:** Update MCP server memory tool handlers to use CortexContext and fluent client API, matching the CLI command pattern

**Architecture:** Replace direct `createMemory(adapter, path, options)` calls with fluent API `store.getMemory(path).create(options)`. Remove `resolveStoreAdapter()` helper, use `ctx.cortex.getStore()` directly.

**Tech Stack:** TypeScript, MCP SDK, @yeseh/cortex-core fluent client API

**Session Id:** Not provided

---

## Background

The CLI commands were recently migrated to use `CortexContext` and the new fluent client API (see `cortex/standup/2026-02-21-store-commands-refactor`). The MCP server memory tools still use the old pattern with:

- `resolveStoreAdapter(ctx, storeName)` to get adapters
- Direct operation calls like `createMemory(adapter, path, options)`
- Old Result handling patterns

They need to be updated to match the CLI pattern:

- `ctx.cortex.getStore(storeName)` to get store clients
- Fluent API: `store.getMemory(path).create(options)`
- Consistent error handling using store client methods

## Files to Update

### Memory Tool Handlers (11 files)

- `packages/server/src/memory/tools/add-memory.ts`
- `packages/server/src/memory/tools/update-memory.ts`
- `packages/server/src/memory/tools/get-memory.ts`
- `packages/server/src/memory/tools/remove-memory.ts`
- `packages/server/src/memory/tools/move-memory.ts`
- `packages/server/src/memory/tools/list-memories.ts`
- `packages/server/src/memory/tools/get-recent-memories.ts`
- `packages/server/src/memory/tools/prune-memories.ts`
- `packages/server/src/memory/tools/reindex-store.ts`

### Shared Utilities

- `packages/server/src/memory/tools/shared.ts` - Remove/update `resolveStoreAdapter()`

### Tests (9 spec files)

- `packages/server/src/memory/tools/add-memory.spec.ts`
- `packages/server/src/memory/tools/update-memory.spec.ts`
- `packages/server/src/memory/tools/get-memory.spec.ts`
- `packages/server/src/memory/tools/remove-memory.spec.ts`
- `packages/server/src/memory/tools/move-memory.spec.ts`
- `packages/server/src/memory/tools/list-memories.spec.ts`
- `packages/server/src/memory/tools/get-recent-memories.spec.ts`
- `packages/server/src/memory/tools/prune-memories.spec.ts`
- `packages/server/src/memory/tools/reindex-store.spec.ts`

## Pattern Comparison

### OLD Pattern (Current MCP)

```typescript
// In handler
const adapterResult = resolveStoreAdapter(ctx, input.store);
if (!adapterResult.ok()) {
    throw adapterResult.error;
}

const result = await createMemory(adapterResult.value, input.path, {
    content: input.content,
    tags: input.tags,
    source: 'mcp',
    expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
    citations: input.citations,
});

if (!result.ok()) {
    throw translateMemoryError(result.error);
}
```

### NEW Pattern (CLI - Target)

```typescript
// In handler
const storeResult = ctx.cortex.getStore(input.store);
if (!storeResult.ok()) {
    throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
}

const store = storeResult.value;
const memoryClient = store.getMemory(input.path);
const result = await memoryClient.create({
    content: input.content,
    metadata: {
        tags: input.tags ?? [],
        source: 'mcp',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
        citations: input.citations ?? [],
    },
});

if (!result.ok()) {
    throw translateMemoryError(result.error);
}

const memory = result.value;
// Use memory.path for normalized path in response
```

## Key Differences

1. **Store Resolution**: `ctx.cortex.getStore()` instead of `resolveStoreAdapter()`
2. **Fluent API**: `store.getMemory(path).create()` instead of `createMemory(adapter, path)`
3. **Metadata Structure**: New API requires explicit `metadata: { createdAt, updatedAt, ... }` object
4. **Return Values**: New API returns `Memory` objects with normalized paths
5. **Error Types**: Store client returns domain errors, not McpErrors

## Implementation Tasks

### Phase 1: Update Shared Utilities

#### Task 1.1: Update shared.ts

- [ ] Remove `resolveStoreAdapter()` function (no longer needed)
- [ ] Keep `translateMemoryError()` as-is (still needed)
- [ ] Keep `ToolContext` interface (already has `cortex: Cortex`)
- [ ] Update imports if needed

### Phase 2: Update Memory Tool Handlers

#### Task 2.1: Update add-memory.ts

- [ ] Replace `resolveStoreAdapter()` call with `ctx.cortex.getStore()`
- [ ] Replace `createMemory(adapter, path, options)` with `store.getMemory(path).create()`
- [ ] Add explicit `metadata` object with `createdAt`, `updatedAt`
- [ ] Use `memory.path` from result for response message
- [ ] Update error handling for store resolution
- [ ] Run tests: `bun test packages/server/src/memory/tools/add-memory.spec.ts`

#### Task 2.2: Update update-memory.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Replace `updateMemory(adapter, path, options)` with `store.getMemory(path).update()`
- [ ] Map input fields to new API format
- [ ] Handle 3-state `expires_at` (undefined/null/Date)
- [ ] Use `memory.path` from result
- [ ] Run tests: `bun test packages/server/src/memory/tools/update-memory.spec.ts`

#### Task 2.3: Update get-memory.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Replace `getMemory(adapter, path, options)` with `store.getMemory(path).get()`
- [ ] Update `includeExpired` option mapping
- [ ] Run tests: `bun test packages/server/src/memory/tools/get-memory.spec.ts`

#### Task 2.4: Update remove-memory.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Replace `removeMemory(adapter, path)` with `store.getMemory(path).delete()`
- [ ] Update response message
- [ ] Run tests: `bun test packages/server/src/memory/tools/remove-memory.spec.ts`

#### Task 2.5: Update move-memory.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Replace `moveMemory(adapter, from, to)` with `store.getMemory(from).move(toPath)`
- [ ] Parse destination path appropriately
- [ ] Run tests: `bun test packages/server/src/memory/tools/move-memory.spec.ts`

#### Task 2.6: Update list-memories.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Use `store.root()` or `store.getCategory(path)` for listing
- [ ] Update to use category client's `listMemories()` method
- [ ] Handle root category case
- [ ] Run tests: `bun test packages/server/src/memory/tools/list-memories.spec.ts`

#### Task 2.7: Update get-recent-memories.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Use appropriate store/category client method
- [ ] Map result format to MCP response
- [ ] Run tests: `bun test packages/server/src/memory/tools/get-recent-memories.spec.ts`

#### Task 2.8: Update prune-memories.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Use `store.root().prune()` for store-wide prune
- [ ] Handle `dry_run` option
- [ ] Run tests: `bun test packages/server/src/memory/tools/prune-memories.spec.ts`

#### Task 2.9: Update reindex-store.ts

- [ ] Replace `resolveStoreAdapter()` with `ctx.cortex.getStore()`
- [ ] Use `store.root().reindex()` for store-wide reindex
- [ ] Run tests: `bun test packages/server/src/memory/tools/reindex-store.spec.ts`

### Phase 3: Verification

#### Task 3.1: Run all MCP tool tests

- [ ] Run: `bun test packages/server/src/memory/tools/`
- [ ] Verify all tests pass
- [ ] Fix any broken tests

#### Task 3.2: Run full test suite

- [ ] Run: `bun test packages/server`
- [ ] Verify no regressions
- [ ] Fix any integration test failures

#### Task 3.3: TypeScript validation

- [ ] Run: `bunx tsc --build`
- [ ] Fix any type errors

### Phase 4: Cleanup and Documentation

#### Task 4.1: Remove dead code

- [ ] Verify `resolveStoreAdapter()` is no longer used
- [ ] Remove the function from `shared.ts`
- [ ] Clean up unused imports

#### Task 4.2: Save progress memory

- [ ] Create memory in `cortex:standup/2026-02-21-mcp-cortex-context-refactor`
- [ ] Document pattern change and files updated
- [ ] Note any issues encountered

## Testing Strategy

1. **Unit tests**: Each handler has colocated spec file - run after updating each handler
2. **Integration tests**: Full test suite in `packages/server/src/memory/tools/`
3. **Type checking**: `bunx tsc --build` to catch type mismatches
4. **Manual verification**: Start MCP server, test a few operations

## Notes

- The fluent API requires explicit `metadata` object with all fields
- `createdAt` and `updatedAt` should use `new Date()` for MCP tools
- CLI uses injectable `ctx.now()` for testing, but MCP can use `new Date()` directly
- Memory paths are normalized by the client, response should use `memory.path`
- Category operations may need `store.getCategory(path)` instead of passing CategoryPath

## Success Criteria

- [ ] All MCP tool handlers use `ctx.cortex.getStore()`
- [ ] All handlers use fluent client API (no direct operation imports)
- [ ] `resolveStoreAdapter()` removed from codebase
- [ ] All tests passing
- [ ] TypeScript compilation clean
- [ ] Pattern consistent with CLI commands
