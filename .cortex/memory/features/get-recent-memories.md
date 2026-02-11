---
created_at: 2026-02-11T20:18:44.284Z
updated_at: 2026-02-11T20:18:44.284Z
tags:
  - feature
  - mcp
  - design
  - issue-18
source: mcp
---
New MCP tool `cortex_get_recent_memories` — returns top-n most recently updated memories with full content for prompt auto-inclusion.

Key decisions:
- Sort by `updated_at` descending, default limit 5
- Add `updatedAt` to `IndexMemoryEntry` (optional, null sorts last)
- Returns raw markdown body + tags + token_estimate
- Flexible scope: store-wide or category-scoped
- Also surface `updated_at` in existing `list_memories` response
- MCP-only, no CLI command for now

Brainstorm doc: `.context/2026-02-11-get-recent-memories-brainstorm.md`
Issue: #18