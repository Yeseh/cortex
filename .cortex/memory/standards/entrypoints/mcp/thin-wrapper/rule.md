---
created_at: 2026-02-13T19:53:07.139Z
updated_at: 2026-02-13T19:53:07.139Z
tags: []
source: mcp
---
MCP tools must be thin wrappers: validate input with Zod, call core operations, and format MCP responses. No filesystem calls or business logic in MCP tools.