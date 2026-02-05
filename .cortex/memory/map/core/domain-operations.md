---
created_at: 2026-01-29T19:54:00.348Z
updated_at: 2026-01-29T19:54:00.348Z
tags:
  - architecture
  - core
  - domain
  - operations
source: mcp
---
Core memory operations exist in `src/core/memory/operations.ts` and should be reused by higher layers.

Available operations:
- createMemory
- getMemory
- updateMemory
- moveMemory
- removeMemory
- listMemories
- pruneExpiredMemories (supports dryRun option)

MCP tools in `src/server/memory/tools.ts` should delegate to these core operations rather than duplicating logic.