# MCP Tool Logging Implementation Plan

**Goal:** Add structured logging calls to all MCP tool handlers so that tool invocations and their outcomes are observable via `ctx.logger`.
**Architecture:** The logging infrastructure (ConsoleLogger for non-OTel, OTel-backed logger for CORTEX_OTEL_ENABLED=true) already exists and is injected into `CortexContext`. Each handler already wraps its work in `withSpan(tracer, ...)`. We add `ctx.logger?.debug(...)` at invocation and `ctx.logger?.debug/info/warn/error(...)` at outcome to each handler.
**Tech Stack:** TypeScript, Bun, @yeseh/cortex-core Logger interface
**Session Id:** ses_356a6eeb8ffebAz1OxU0GIlqsz

---

## Logging Strategy

### Log levels per event
| Event | Level | Rationale |
|-------|-------|-----------|
| Tool invoked (entering handler) | `debug` | Verbose; useful in development, too noisy for production |
| Tool succeeded | `debug` | Normal path; noisy for high-frequency read operations |
| Tool failed with client error (InvalidParams) | `debug` | Client-correctable; no operator action needed |
| Tool failed with server/storage error | `error` | Operator needs to know |
| Dry-run executed | `debug` | Informational |

### Metadata keys (snake_case, matches observability spec)
- `store` — store name
- `path` / `from_path` / `to_path` — memory paths
- `category` — category path when applicable
- `error_code` — domain error code on failure
- `count` / `pruned_count` — numeric results where relevant
- `dry_run` — boolean flag

### Guard pattern (logger is optional)
```typescript
ctx.logger?.debug('cortex_add_memory invoked', { store: input.store, path: input.path });
```

---

## Tasks

### Implementation tasks (all in packages/server/src)

#### TASK-1: Memory tool handlers — memory/tools/*.ts (9 files)

For each handler below, add two log calls inside the `withSpan` callback:
1. **On entry** — `ctx.logger?.debug('<tool_name> invoked', { ...key inputs })`
2. **On success** — `ctx.logger?.debug('<tool_name> succeeded', { ...key outputs })`
3. **On domain error** — `ctx.logger?.debug/error('<tool_name> failed', { error_code: ..., store: ... })`
   - Use `debug` for client-correctable errors (InvalidParams path)
   - Use `error` for storage/internal errors

Files and specific log metadata:

**add-memory.ts**
```typescript
// On entry:
ctx.logger?.debug('cortex_add_memory invoked', { store: input.store, path: input.path });
// After successful create:
ctx.logger?.debug('cortex_add_memory succeeded', { store: input.store, path: memory.path });
// After translateMemoryError path (before throw):
ctx.logger?.debug('cortex_add_memory failed', { store: input.store, path: input.path, error_code: result.error.code });
```

**get-memory.ts**
```typescript
ctx.logger?.debug('cortex_get_memory invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_get_memory succeeded', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_get_memory failed', { store: input.store, path: input.path, error_code: result.error.code });
```

**update-memory.ts**
```typescript
ctx.logger?.debug('cortex_update_memory invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_update_memory succeeded', { store: input.store, path: memory.path });
ctx.logger?.debug('cortex_update_memory failed', { store: input.store, path: input.path, error_code: result.error.code });
```

**remove-memory.ts**
```typescript
ctx.logger?.debug('cortex_remove_memory invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_remove_memory succeeded', { store: input.store, path: input.path });
ctx.logger?.error('cortex_remove_memory failed', undefined, { store: input.store, path: input.path, error_code: result.error.code });
```

**move-memory.ts**
```typescript
ctx.logger?.debug('cortex_move_memory invoked', { store: input.store, from_path: input.from_path, to_path: input.to_path });
ctx.logger?.debug('cortex_move_memory succeeded', { store: input.store, from_path: input.from_path, to_path: input.to_path });
ctx.logger?.debug('cortex_move_memory failed', { store: input.store, from_path: input.from_path, error_code: result.error.code });
```

**list-memories.ts**
```typescript
ctx.logger?.debug('cortex_list_memories invoked', { store: input.store, category: input.category });
ctx.logger?.debug('cortex_list_memories succeeded', { store: input.store, category: input.category, count: memories.length });
```
(Errors in collectMemories are thrown; caught by withSpan — no extra log needed)

**prune-memories.ts**
```typescript
ctx.logger?.debug('cortex_prune_memories invoked', { store: input.store, dry_run: dryRun });
ctx.logger?.debug('cortex_prune_memories succeeded', { store: input.store, dry_run: dryRun, count: prunedEntries.length });
```

**reindex-store.ts**
```typescript
ctx.logger?.debug('cortex_reindex_store invoked', { store: input.store });
ctx.logger?.debug('cortex_reindex_store succeeded', { store: input.store, warnings: result.value.warnings.length });
```

**get-recent-memories.ts**
```typescript
ctx.logger?.debug('cortex_get_recent_memories invoked', { store: input.store, category: input.category, limit: input.limit });
ctx.logger?.debug('cortex_get_recent_memories succeeded', { store: input.store, count: recentResult.count });
```

#### TASK-2: Category tool handlers — category/tools.ts (3 handlers)

**createCategoryHandler**
```typescript
ctx.logger?.debug('cortex_create_category invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_create_category succeeded', { store: input.store, path: result.value.path, created: result.value.created });
```

**setCategoryDescriptionHandler**
```typescript
ctx.logger?.debug('cortex_set_category_description invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_set_category_description succeeded', { store: input.store, path: input.path });
```

**deleteCategoryHandler**
```typescript
ctx.logger?.debug('cortex_delete_category invoked', { store: input.store, path: input.path });
ctx.logger?.debug('cortex_delete_category succeeded', { store: input.store, path: input.path });
```

#### TASK-3: Store tool handlers — store/tools.ts (2 handlers)

**listStoresHandler**
```typescript
ctx.logger?.debug('cortex_list_stores invoked');
ctx.logger?.debug('cortex_list_stores succeeded', { count: stores.length });
```

**createStoreHandler**
```typescript
ctx.logger?.debug('cortex_create_store invoked', { name: input.name });
ctx.logger?.debug('cortex_create_store succeeded', { name: input.name });
```

### Testing tasks

#### TASK-4: Tests for logging in memory tool handlers
- In each `*.spec.ts` for memory tools, add tests verifying `ctx.logger` is called with expected arguments
- Use a mock logger factory (spy on `debug`, `info`, `error`)
- Test: invoked log fires with correct metadata
- Test: success log fires after successful operation
- Test: error log fires when operation fails

#### TASK-5: Tests for logging in category and store tool handlers
- Same pattern as TASK-4 for category/tools.spec.ts and store/tools.spec.ts

---

## Dependency Map

```
TASK-1 (memory tools) ─── independent
TASK-2 (category tools) ── independent  
TASK-3 (store tools) ───── independent
   → all feed into TASK-4+5 (tests)
      → feeds into code review
         → feeds into doc update → commit → PR
```

TASK-1, TASK-2, TASK-3 can all run in parallel.
TASK-4, TASK-5 can run in parallel after their respective implementation tasks.
