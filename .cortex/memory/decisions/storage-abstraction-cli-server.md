---
created_at: 2026-01-31T14:47:40.100Z
updated_at: 2026-01-31T14:47:40.100Z
tags:
  - architecture
  - decision
  - storage
  - cli
  - server
source: mcp
---
## Storage Abstraction in CLI and Server

**Date:** 2026-01-31
**PR:** #12 (merged)

### Context
CLI and Server directly instantiated `FilesystemStorageAdapter`, creating tight coupling to a specific storage implementation.

### Decision
Use the `Registry.getStore()` pattern (from registry-abstraction) instead of direct adapter instantiation.

### Implementation

**CLI Context** (`src/cli/context.ts`):
- Added `resolveStoreAdapter(storeName)` → returns `{ context, adapter }`
- Fallback: Creates `FilesystemStorageAdapter` for local/global stores not in registry
- Commands use `deps.adapter ?? storeResult.value.adapter` for test injection

**CLI Commands Pattern**:
```typescript
const storeResult = resolveStoreAdapter(storeName);
const adapter = deps.adapter ?? storeResult.value.adapter;
// Use focused interfaces:
adapter.memories.read()
adapter.memories.write()
adapter.indexes.reindex()
```

**MCP Server Pattern**:
```typescript
const store = registry.getStore(storeName);
const adapter = store.adapter;  // ScopedStorageAdapter
```

### Key Files
- CLI: `src/cli/context.ts`, `src/cli/commands/memory/*.ts`, `src/cli/commands/store/*.ts`
- Server: `src/server/memory/tools.ts`, `src/server/category/tools.ts`, `src/server/memory/resources.ts`