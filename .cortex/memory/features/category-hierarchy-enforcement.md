---
{created_at: 2026-02-17T20:13:00.151Z,updated_at: 2026-02-17T20:13:00.151Z,tags: [feature,category,hierarchy,config,breaking-change],source: mcp,citations: [.context/2026-02-17-category-hierarchy-brainstorm.md]}
---
# Feature: Category Hierarchy Enforcement

## Status
Brainstorm Complete (2026-02-17)

## Summary
Add ability to define and enforce category hierarchies per store in `config.yaml`. A `categoryMode` setting (`free`, `subcategories`, `strict`) controls enforcement level.

## Key Design Decisions

### Breaking Changes
1. **`createMemory` no longer auto-creates categories** - requires `create_category` first
2. **New config schema** - `categoryMode` and `categories` keys in store definition
3. **`list_stores` response shape changed** - includes hierarchy information

### Mode Behaviors
- `free`: Agent can create/delete any categories (default)
- `subcategories`: Agent can only create/delete non-root categories
- `strict`: `create_category` and `delete_category` tools not registered with MCP server

### Config-Defined Categories Are Protected
- Cannot be deleted via `delete_category`
- Cannot have descriptions modified via `set_category_description`
- All ancestors of defined categories are implicitly protected

### Legacy Categories Remain Operable
Categories on disk but not in config can still have memories created in them, be deleted, and have descriptions set.

## Config Schema Example
```yaml
stores:
  cortex:
    path: /home/user/.cortex/memory
    categoryMode: strict
    categories:
      standards:
        description: "Coding standards"
        subcategories:
          architecture:
            description: "System architecture"
```

## Enforcement
- Core domain operations enforce mode
- MCP server: tool registration + delegation to core
- CLI: delegation to core
- Storage adapters: no policy (pure I/O)

## References
- `.context/2026-02-17-category-hierarchy-brainstorm.md` - Full brainstorm session