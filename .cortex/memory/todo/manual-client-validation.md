---
created_at: 2026-02-18T10:00:00.000Z
updated_at: 2026-02-27T20:27:48.113Z
tags: 
  - todo
  - api-review
  - client-hierarchy
  - validation
  - completed
source: mcp
---
# Manual Client API Validation

Walk through the fluent client implementations and try to implement some handlers to validate the API ergonomics.

## Goals
- Verify the client hierarchy works well in practice: `Cortex → StoreClient → CategoryClient → MemoryClient`
- Test lazy validation patterns feel natural
- Identify any rough edges or missing convenience methods
- Validate error handling patterns are consistent

## Tasks

### 1. Implement a sample MCP handler using clients
- [x] Pick an existing MCP tool handler (e.g., `cortex_add_memory`)
- [x] Refactor it to use the fluent client API instead of raw adapter
- [x] Compare ergonomics: is the code cleaner? More verbose?

### 2. Implement a sample CLI handler using clients
- [x] Pick an existing CLI command handler (e.g., `memory add`)
- [x] Refactor it to use the fluent client API
- [x] Note any friction points

### 3. Test navigation patterns
- [x] Try chaining: `cortex.getStore('x').root().getCategory('a/b').getMemory('slug')`
- [x] Test parent navigation: `category.parent()`
- [x] Test error propagation through the chain

### 4. Document findings
- [x] Note any missing methods that would improve ergonomics
- [x] Note any inconsistencies in the API surface
- [x] Propose improvements if needed

## Findings (2026-02-27)

### What's working well
- Memory CRUD handlers (add, get, update, remove, move, prune, reindex, get-recent, list) ALL use the fluent API. Migration is complete for memory operations.
- Error propagation is consistent: INVALID_PATH from lazy validation, domain errors bubble cleanly through Result types.
- Parent navigation (`category.parent()`) works correctly; returns null at root.

### Issues found

**Issue 1 — Category tools bypass the client (main gap)**
`packages/server/src/category/tools.ts:244,315,397` all do:
```typescript
const adapter = (storeResult.value as any).adapter;
```
Root cause: `CategoryClient.create()`, `delete()`, `setDescription()` don't accept `modeContext`. The category tool handlers need to pass `modeContext` to the domain operations, but the `CategoryClient` methods don't expose that parameter. Until `modeContext` is threaded through the client API, these handlers must bypass the client.

**Issue 2 — Dead `store.root()` call in CLI `add.ts` (FIXED)**
`add.ts` called `store.root()` and checked for errors but never used the result. The memory client was obtained via `store.getMemory(path)` directly. Removed the dead code.

**Issue 3 — `rootCategory()` references in JSDoc (FIXED)**
All JSDoc examples in `cortex.ts`, `category-client.ts`, `store-client.ts` referenced the non-existent method `store.rootCategory()`. The actual method is `store.root()`. Fixed all occurrences.

**Issue 4 — Chaining is verbose due to Result wrappers**
`CategoryClient.getCategory()` returns `CategoryResult<CategoryClient>`, not a plain `CategoryClient`. Each navigation step requires `.ok()` check + unwrap. The full chain looks like:
```typescript
const storeResult = cortex.getStore('x');           // Result
const rootResult = storeResult.value.root();         // Result
const catResult = rootResult.value.getCategory('a/b'); // Result
const memClient = catResult.value.getMemory('slug'); // (no Result)
```
Handlers often short-circuit this by calling `store.getMemory(fullPath)` directly.

**Issue 5 — `store.getCategory()` vs `root.getCategory()` — redundant paths**
`StoreClient.getCategory(path)` and `store.root().value.getCategory(path)` both reach the same place. The former is slightly less safe (skips root validation), the latter is more idiomatic but more verbose.

## Context
- PR #41 adds StoreClient with lazy validation
- CategoryClient and MemoryClient already exist
- Category tools still use `getAdapter()` escape hatch for modeContext - see Issue 1
