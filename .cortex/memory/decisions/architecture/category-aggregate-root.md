---
{created_at: 2026-02-17T20:44:37.255Z,updated_at: 2026-02-17T20:44:37.255Z,tags: [decision,architecture,domain-modeling,fluent-api],source: mcp}
---
# Decision: Category as Aggregate Root

## Date
2026-02-17

## Context
When designing the fluent client API (`StoreClient`, `CategoryClient`, `MemoryClient`), we needed to decide whether memories could be accessed directly from a store or only through categories.

## Decision
Categories are the aggregate root for memories. All memory access flows through categories - there is no `store.getMemory(fullPath)` shortcut.

```typescript
// Required pattern - navigate through category
store.rootCategory().getCategory('standards').getMemory('style')

// NOT supported - no direct memory access from store
store.getMemory('standards/style')  // ❌ Does not exist
```

## Rationale
- Categories own their memories in the domain model
- Enforces consistent navigation patterns
- Simplifies the StoreClient API (only `rootCategory()`)
- Makes the hierarchy explicit in code

## Consequences
- Slightly more verbose for known paths
- Clear ownership boundaries
- Consistent with how the filesystem storage is organized