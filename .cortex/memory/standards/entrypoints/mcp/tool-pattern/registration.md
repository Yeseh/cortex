---
created_at: 2026-02-13T19:53:07.156Z
updated_at: 2026-02-13T19:53:07.156Z
tags: []
source: mcp
---
Tool registration uses server.tool(name, description, inputSchema.shape, handler) with parseInput(schema, input) before delegating to a handler.