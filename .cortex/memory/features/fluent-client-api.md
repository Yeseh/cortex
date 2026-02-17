---
created_at: 2026-02-17T20:36:26.000Z
updated_at: 2026-02-17T20:36:26.000Z
tags: [feature, api, client, azure-sdk, fluent]
source: mcp
citations: [.context/2026-02-17-fluent-client-api-brainstorm.md]
---

# Feature: Fluent Client API (Azure SDK Style)

## Status

Brainstorm Complete (2026-02-17)

## Summary

Expand the Cortex client to provide hierarchical `StoreClient`, `CategoryClient`, and `MemoryClient` classes with a fluent, Azure SDK-style API.

**Target pattern:**

```typescript
cortex.getStore('my-store').rootCategory().getCategory('standards/javascript').getMemory('style');
```

## Key Design Decisions

### Synchronous Client Creation

All navigation methods (`getStore()`, `getCategory()`, `getMemory()`) return client objects immediately without hitting disk. Invalid paths are accepted - validation errors surface on first async operation.

### Category as Aggregate Root

Memories are only accessible through categories. No `store.getMemory(fullPath)` shortcut.

### Result Types Throughout

All async operations return `Result<T, E>`. Consistent with existing codebase.

### Clients Wrap Domain Operations

Existing `core/memory/operations/` and `core/category/operations/` are reused.

## Client Hierarchy

```
Cortex
  └── getStore(name) → StoreClient
        └── rootCategory() → CategoryClient
              ├── getCategory(path) → CategoryClient
              ├── getMemory(slug) → MemoryClient
              └── parent() → CategoryClient | null
```

## StoreClient

- Readonly: `name`, `path`, `description?`
- Navigation: `rootCategory()`

## CategoryClient

- Raw: `rawPath` (canonical: `/standards/javascript`)
- Parse: `parsePath()`
- Navigation: `getCategory()`, `getMemory()`, `parent()`
- Lifecycle: `create()`, `delete()` (always recursive), `exists()`
- Metadata: `setDescription()`
- Listing: `listMemories()`, `listSubcategories()`
- Operations: `reindex()`, `prune()` (scoped to subtree)

## MemoryClient

- Raw: `rawPath`, `rawSlug`
- Parse: `parsePath()`, `parseSlug()`
- Lifecycle: `create()`, `get()`, `update()`, `delete()`, `exists()`
- Operations: `move(destination: MemoryClient | MemoryPath)`

## Path Format

Canonical format uses leading slash (`/standards/javascript`). Input is normalized:

- Add leading `/` if missing
- Strip trailing `/`
- Collapse multiple slashes

Root category path is `/`.

## Dependencies

- Builds on `migrate-to-cortex-client` change (PR #38)

## References

- `.context/2026-02-17-fluent-client-api-brainstorm.md` - Full brainstorm session
