# Change: Add Category Mode Enforcement

## Why

With category hierarchies defined in config, the system needs to enforce mode-based permissions and protect config-defined categories. This enables users to lock down category structures while still allowing flexible memory creation within those structures.

## What Changes

- **BREAKING**: `createMemory` no longer auto-creates categories (requires category to exist)
- `createCategory` enforces mode rules (free/subcategories/strict)
- `deleteCategory` rejects config-defined categories (protected)
- `setDescription` rejects config-defined categories (protected)
- MCP server conditionally registers category tools based on mode
- In `strict` mode, `create_category` and `delete_category` tools are not registered

## Impact

- Affected specs: `category-core`, `mcp-category-tools`, `memory-core`
- Affected code:
    - `packages/core/src/category/operations/create.ts`
    - `packages/core/src/category/operations/delete.ts`
    - `packages/core/src/category/operations/setDescription.ts`
    - `packages/core/src/memory/operations/create.ts`
    - `packages/server/src/category/tools.ts`

## Dependencies

- Requires `add-category-hierarchy-config` to be implemented first (config parsing and category path resolution)
