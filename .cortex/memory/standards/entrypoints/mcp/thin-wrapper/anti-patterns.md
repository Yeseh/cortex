---
created_at: 2026-02-13T19:53:07.157Z
updated_at: 2026-02-13T19:53:07.157Z
tags: []
source: mcp
---
Avoid MCP tools that mkdir/read/write files directly, or duplicate core validation/coordination logic. Core is the single source of truth.