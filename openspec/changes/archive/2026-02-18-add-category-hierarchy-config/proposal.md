# Change: Add Category Hierarchy Configuration

## Why

Users need to define and protect category structures per store. Currently, categories are implicitly created and have no protection mechanisms. This change introduces config-level category hierarchy definitions with mode-based enforcement.

## What Changes

- **BREAKING**: `list_stores` response shape changes to include hierarchy information
- Add `categoryMode` field to store config (`free | subcategories | strict`)
- Add `categories` field to store config for defining protected hierarchies
- Config-defined categories include descriptions and arbitrary nesting depth
- `list_stores` returns defined hierarchy from config (not disk state)

## Impact

- Affected specs: `config`, `mcp-store-resources`
- Affected code: `packages/core/src/config.ts`, `packages/server/src/store/tools.ts`

## Dependencies

- None (foundation for `add-category-mode-enforcement`)
