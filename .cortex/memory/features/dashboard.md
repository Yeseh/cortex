---
created_at: 2026-02-05T21:09:01.437Z
updated_at: 2026-02-05T21:09:01.437Z
tags:
  - feature
  - dashboard
  - ui
  - statistics
  - wip
source: mcp
---
# Feature: UI Dashboard

**Status:** Brainstorming complete, pending formal spec
**Brainstorm doc:** `docs/brainstorm/2026-02-05-dashboard-feature.md`

## Summary

UI dashboard for viewing, editing, and maintaining the Cortex memory system with access statistics to identify usage patterns and hotspots.

## Key Decisions

- **Deployment:** Separate process from MCP server
- **Architecture:** Uses shared `@yeseh/cortex-core` + `@yeseh/cortex-storage-fs` directly
- **Frontend:** Vanilla JS, works offline
- **Stats storage:** SQLite at `~/.config/cortex/dashboard.db` (registry-level, cross-store)
- **Entry point:** `cortex dashboard` CLI command

## Scope

1. **View:** Store overview, category tree browser, memory viewer, path/tag search
2. **Edit:** Memory content + metadata editing, bulk operations, category/store management
3. **Maintain:** Prune expired, reindex, health checks, export/import, cleanup
4. **Statistics:** Event-based access tracking, read count + last accessed, heatmap visualization

## New Packages Required

- `@yeseh/cortex-stats` — Access tracking with SQLite (isolates dependency)
- `@yeseh/cortex-dashboard` — HTTP server + static assets

## Open Questions

- SQLite path coupling: how consumers get stats without knowing storage location
- Adapter construction convenience: reduce boilerplate for tracked environments