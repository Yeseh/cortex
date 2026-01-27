# Change: Add Category Descriptions

## Why

AI agents need better discoverability when exploring memory categories. Adding optional descriptions to categories improves context without requiring agents to read individual memories. This change also introduces a new `src/core/category` module to centralize category business logic, establishing a cleaner architecture pattern for the codebase.

## What Changes

- Add optional `description` field (max 500 chars) to category subcategory entries in `index.yaml`
- Create new `src/core/category` module with pure business logic for category operations
- Introduce `CategoryStoragePort` interface for abstract storage access
- Add `createCategory(path)` operation - creates category + parents (idempotent)
- Add `setDescription(path, description)` operation - sets/clears description on existing category
- Add `deleteCategory(path)` operation - deletes category and all contents recursively
- Add MCP tools: `cortex_create_category`, `cortex_set_category_description`, `cortex_delete_category`
- Update `list_memories` response to include description field in subcategories

## Impact

- Affected specs:
    - New `category-core` capability
    - Modified `index` (subcategory description field)
    - New `mcp-category-tools` capability
- Affected code:
    - `src/core/category/` - new module
    - `src/core/index/types.ts` - type changes
    - `src/server/category/` - MCP tools
- No breaking changes to existing APIs
- Existing `index.yaml` files remain valid (description field is optional)
