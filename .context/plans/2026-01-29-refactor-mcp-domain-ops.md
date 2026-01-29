# Refactor MCP Tools to Use Domain Operations

**Goal:** Transform MCP memory tool handlers from directly manipulating filesystem to calling domain operations from `src/core/memory/operations.ts`
**Architecture:** MCP tools become thin wrappers: parse input → call domain operation → format MCP response
**Tech Stack:** TypeScript, Bun, MCP SDK
**Session Id:** ses_3f4a9e8edffensSAfmft55Eukv

---

## Overview

The MCP server (`src/server/memory/tools.ts`) currently:

- Directly calls `FilesystemStorageAdapter` methods
- Contains duplicated business logic (serialization, index coordination)
- Has its own `mkdir` calls for directory creation
- Duplicates expiration checking logic

After refactoring:

- MCP handlers call domain operations from `src/core/memory/operations.ts`
- Domain operations handle all business logic
- MCP handlers only handle: input parsing → domain call → response formatting
- Error translation from domain errors to MCP errors

## Task Breakdown

### Task 3: Update resolveStoreRoot to return ComposedStorageAdapter

**Files:** `src/server/memory/tools.ts`

**Current state:**

```typescript
const resolveStoreRoot = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<string, McpError>> => {
    // Returns store root path string
};

const createAdapter = (storeRoot: string): FilesystemStorageAdapter => {
    return new FilesystemStorageAdapter({ rootDirectory: storeRoot });
};
```

**Target state:**

```typescript
const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<ComposedStorageAdapter, McpError>> => {
    // Load registry
    // Resolve store path
    // If autoCreate, ensure directory exists using mkdir
    // Return FilesystemStorageAdapter (implements ComposedStorageAdapter)
};
```

**Key changes:**

- Rename `resolveStoreRoot` → `resolveStoreAdapter`
- Return `FilesystemStorageAdapter` directly instead of path string
- Remove separate `createAdapter` helper
- Keep `autoCreate` logic for `mkdir` in this function

### Task 4: Refactor addMemoryHandler

**Files:** `src/server/memory/tools.ts`

**Current:**

```typescript
export const addMemoryHandler = async (ctx: ToolContext, input: AddMemoryInput) => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    // ... validation, serialization, adapter.writeMemoryFile ...
};
```

**Target:**

```typescript
import { createMemory } from '../../core/memory/operations.ts';

export const addMemoryHandler = async (ctx: ToolContext, input: AddMemoryInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, true);
    if (!adapter.ok) throw adapter.error;

    const result = await createMemory(adapter.value, input.path, {
        content: input.content,
        tags: input.tags,
        source: 'mcp',
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return { content: [{ type: 'text', text: `Memory created at ${input.path}` }] };
};
```

### Task 5: Refactor getMemoryHandler

**Target:**

```typescript
import { getMemory } from '../../core/memory/operations.ts';

export const getMemoryHandler = async (ctx: ToolContext, input: GetMemoryInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapter.ok) throw adapter.error;

    const result = await getMemory(adapter.value, input.path, {
        includeExpired: input.include_expired,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    // Format response
    const output = {
        path: input.path,
        content: result.value.content,
        metadata: {
            created_at: result.value.frontmatter.createdAt.toISOString(),
            updated_at: result.value.frontmatter.updatedAt.toISOString(),
            tags: result.value.frontmatter.tags,
            source: result.value.frontmatter.source,
            expires_at: result.value.frontmatter.expiresAt?.toISOString(),
        },
    };

    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
};
```

### Task 6: Refactor updateMemoryHandler

**Target:**

```typescript
import { updateMemory } from '../../core/memory/operations.ts';

export const updateMemoryHandler = async (ctx: ToolContext, input: UpdateMemoryInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapter.ok) throw adapter.error;

    const result = await updateMemory(adapter.value, input.path, {
        content: input.content,
        tags: input.tags,
        expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
        clearExpiry: input.clear_expiry,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return { content: [{ type: 'text', text: `Memory updated at ${input.path}` }] };
};
```

### Task 7: Refactor removeMemoryHandler

**Target:**

```typescript
import { removeMemory } from '../../core/memory/operations.ts';

export const removeMemoryHandler = async (ctx: ToolContext, input: RemoveMemoryInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapter.ok) throw adapter.error;

    const result = await removeMemory(adapter.value, input.path);

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return { content: [{ type: 'text', text: `Memory removed at ${input.path}` }] };
};
```

### Task 8: Refactor moveMemoryHandler

**Target:**

```typescript
import { moveMemory } from '../../core/memory/operations.ts';

export const moveMemoryHandler = async (ctx: ToolContext, input: MoveMemoryInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapter.ok) throw adapter.error;

    const result = await moveMemory(adapter.value, input.from_path, input.to_path);

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [
            { type: 'text', text: `Memory moved from ${input.from_path} to ${input.to_path}` },
        ],
    };
};
```

### Task 9: Refactor listMemoriesHandler

**Target:**

```typescript
import { listMemories } from '../../core/memory/operations.ts';

export const listMemoriesHandler = async (ctx: ToolContext, input: ListMemoriesInput) => {
    const adapter = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapter.ok) throw adapter.error;

    const result = await listMemories(adapter.value, {
        category: input.category,
        includeExpired: input.include_expired,
    });

    if (!result.ok) {
        throw translateMemoryError(result.error);
    }

    // Format response to match expected MCP output
    const output = {
        category: result.value.category || 'all',
        count: result.value.memories.length,
        memories: result.value.memories.map((m) => ({
            path: m.path,
            token_estimate: m.tokenEstimate,
            summary: m.summary,
            expires_at: m.expiresAt?.toISOString(),
            is_expired: m.isExpired,
        })),
        subcategories: result.value.subcategories.map((s) => ({
            path: s.path,
            memory_count: s.memoryCount,
            description: s.description,
        })),
    };

    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
};
```

### Task 10: pruneMemoriesHandler - ALREADY DONE

Already delegates to `pruneExpiredMemories` from core operations.

### Task 11: Clean Up

**Remove:**

- `ROOT_CATEGORIES` constant (use from domain)
- `isExpired` helper (use from domain)
- `createAdapter` helper (replaced by resolveStoreAdapter)
- Direct `mkdir` import (except in resolveStoreAdapter)
- Unused imports: `parseMemoryFile`, `serializeMemoryFile`, `validateMemorySlugPath`, `parseIndex`

**Add:**

- `translateMemoryError` helper to convert MemoryError to McpError

### Error Translation Helper

```typescript
const translateMemoryError = (error: MemoryError): McpError => {
    switch (error.code) {
        case 'MEMORY_NOT_FOUND':
            return new McpError(ErrorCode.InvalidParams, `Memory not found: ${error.path}`);
        case 'MEMORY_EXPIRED':
            return new McpError(ErrorCode.InvalidParams, `Memory expired: ${error.path}`);
        case 'INVALID_PATH':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'INVALID_INPUT':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'DESTINATION_EXISTS':
            return new McpError(
                ErrorCode.InvalidParams,
                `Destination already exists: ${error.path}`
            );
        case 'STORAGE_ERROR':
        default:
            return new McpError(ErrorCode.InternalError, error.message);
    }
};
```

## Dependency Map

```
Task 3 (resolveStoreAdapter) ─────┬──────────────────────────────────┐
                                  │                                  │
                        ┌─────────┴─────────┐                        │
                        v                   v                        │
              Tasks 4-9 (handlers)   Task 11 (cleanup)              │
                        │                   │                        │
                        └─────────┬─────────┘                        │
                                  v                                  │
                           Task 12 (tests)                           │
                                  │                                  │
                                  v                                  │
                           Task 13 (review)                          │
                                  │                                  │
                                  v                                  │
                           Task 14 (commit)                          │
                                  │                                  │
                                  v                                  │
                           Task 15 (PR)                              │
```

- Task 3 must be done first (foundation)
- Tasks 4-9 can be done in parallel after Task 3
- Task 11 can be done after handlers are refactored
- Task 12 runs after all code changes
- Tasks 13-15 are sequential at the end

## Notes

- All existing tests should continue to pass (no API changes)
- Response formats must remain identical
- Error messages should remain similar for backward compatibility
