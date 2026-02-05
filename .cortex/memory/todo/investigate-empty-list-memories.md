---
created_at: 2026-02-05T18:23:54.632Z
updated_at: 2026-02-05T18:23:54.632Z
tags:
  - bug
  - investigation
  - mcp
source: mcp
---
Investigate why `cortex_list_memories` returns empty results for store roots despite memories existing in the filesystem. The MCP tools show `count: 0` and empty `memories`/`subcategories` arrays, but glob shows actual files exist in the memory directories.