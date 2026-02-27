# Category Descriptions Feature

**Date:** 2026-01-26  
**Status:** Brainstorm Complete

## Overview

Add optional descriptions to categories to improve discoverability by agents. Descriptions are stored in the parent category's `index.yaml` under the `subcategories` field. This feature also introduces a new `src/core/category` module to centralize category business logic, setting a pattern for refactoring existing server/CLI logic.

## Requirements

### Category Descriptions

- **Optional** plain text description per category
- **Max 500 characters**, whitespace trimmed
- **Stored** in parent category's `index.yaml` subcategories entry
- **No inheritance** - each category's description is independent
- **Persist** even when all memories in a category are deleted
- **Root categories** (e.g., `human`, `persona`, `project`) are special and cannot have descriptions

### New Operations

| Operation                           | Behavior                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCategory(path)`              | Creates category + parents (except root). Idempotent - returns `{ path, created: boolean }`. Creates empty `index.yaml` files as needed.                        |
| `setDescription(path, description)` | Sets/clears description on existing category. Rejects root paths with explicit error. Trims whitespace, enforces 500 char limit. Empty string allowed to clear. |
| `deleteCategory(path)`              | Deletes category and all contents (memories + subcategories recursively). Rejects root paths with explicit error.                                               |

## Architecture

### New Module: `src/core/category`

Contains pure business logic for category operations. Does **not** depend on `src/core/storage/filesystem.ts` - uses an abstract port interface instead.

### Storage Port Interface

```typescript
interface CategoryStoragePort {
    readIndex(categoryPath: string): Promise<Result<CategoryIndex | null, StorageError>>;
    writeIndex(categoryPath: string, index: CategoryIndex): Promise<Result<void, StorageError>>;
    updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, StorageError>>;
    ensureDirectory(categoryPath: string): Promise<Result<void, StorageError>>;
    deleteDirectory(categoryPath: string): Promise<Result<void, StorageError>>;
}
```

### Type Changes

```typescript
// src/core/index/types.ts
interface IndexSubcategoryEntry {
    path: string;
    memoryCount: number;
    description?: string; // NEW: optional, max 500 chars
}
```

### Serialization Format

```yaml
subcategories:
    - path: projects/cortex
      memory_count: 5
      description: Cortex memory system project knowledge
```

## MCP Tools

Thin wrappers that delegate to core module:

| Tool                              | Parameters                      | Behavior                                                                    |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `cortex_create_category`          | `store?`, `path`                | Calls core `createCategory`                                                 |
| `cortex_set_category_description` | `store?`, `path`, `description` | Creates category if needed (at MCP layer), then calls core `setDescription` |
| `cortex_delete_category`          | `store?`, `path`                | Calls core `deleteCategory`                                                 |

## Edge Cases

| Scenario                                                     | Behavior                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `createCategory("projects/cortex/arch")` when nothing exists | Creates `projects/cortex/` and `projects/cortex/arch/` with empty indexes. Does NOT create root `projects/`. |
| `createCategory` on existing category                        | Idempotent, returns `{ path, created: false }`                                                               |
| `setDescription` on root category                            | Returns explicit error for agent feedback                                                                    |
| `setDescription` on non-existent category (core)             | Returns error (MCP layer handles auto-creation)                                                              |
| `deleteCategory` on root                                     | Returns explicit error                                                                                       |
| `deleteCategory` on category with subcategories              | Deletes everything recursively                                                                               |
| All memories deleted from category                           | Category entry and description persist in parent index                                                       |

## Impact on Existing Functionality

- `list_memories` response will include `description` field in subcategories (when present)
- Existing `index.yaml` files without descriptions remain valid (field is optional)
- No breaking changes to existing APIs

## Design Decisions

1. **Separate core module** - Server and CLI have too much logic; this sets pattern for future refactoring
2. **Abstract storage port** - Enables testability and potential future storage backends
3. **Explicit methods over overloading** - `updateSubcategoryDescription` is dedicated method, not merged into `writeIndex`
4. **MCP layer handles convenience** - Core keeps `create` and `setDescription` separate; MCP combines for UX
5. **Pre-creation supported** - Categories can exist with descriptions before any memories are added
