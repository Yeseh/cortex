---
created_at: 2026-02-26T19:43:07.590Z
updated_at: 2026-02-26T19:59:21.618Z
tags: 
  - roadmap
  - planning
source: mcp
---
# Post 1.0 Roadmap

Planned features after the 1.0 release.

## Category Policies
Category-level policy system for enforcing rules on memories and subcategories. Includes defaultTtl, maxContentLength, create/update/delete permissions, and subcategoryCreation control. Replaces store-level categoryMode. Breaking change.
- Feature: `features/category-policies`
- Brainstorm: `.context/2026-02-26-category-policies-brainstorm.md`

## CLI Category Bootstrapping
Predefined templates (`agent-project`, `minimal`, `personal`) for `cortex store init`. Depends on category mode enforcement / category policies.
- OpenSpec: `add-cli-category-bootstrapping` (0/14 tasks, deferred)

## SQLite Derived Index
Replace per-category YAML index files with a single SQLite database per store. The DB is a derived, rebuildable cache — filesystem stays source of truth. Enables structured metadata queries via a new `cortex_query_memories` MCP tool.
- Feature: `features/sqlite-derived-index`
- Brainstorm: `.context/2026-02-13-sqlite-index-brainstorm.md`
- OpenSpec proposals: `refactor-index-storage` (prerequisite), `add-sqlite-index` (main)