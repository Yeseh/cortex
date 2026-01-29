---
created_at: 2026-01-29T20:28:55.574Z
updated_at: 2026-01-29T20:28:55.574Z
tags:
  - architecture
  - mcp
  - patterns
source: mcp
---
MCP tool handlers follow the "thin wrapper" pattern:
- Parse input with Zod schema
- Resolve storage adapter (resolveStoreAdapter)
- Call domain operation from src/core/memory/operations.ts
- Translate domain errors to McpError (translateMemoryError)
- Format and return MCP response

Domain operations handle all business logic. MCP layer only handles:
- Input validation
- Adapter resolution  
- Error translation
- Response formatting