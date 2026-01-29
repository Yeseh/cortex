---
created_at: 2026-01-29T20:28:58.679Z
updated_at: 2026-01-29T20:28:58.679Z
tags:
  - mcp
  - errors
  - patterns
source: mcp
---
Domain errors (MemoryError) map to MCP errors (McpError):

Client-correctable → ErrorCode.InvalidParams:
- MEMORY_NOT_FOUND
- MEMORY_EXPIRED  
- INVALID_PATH
- INVALID_INPUT
- DESTINATION_EXISTS

Parsing/corruption → ErrorCode.InternalError:
- MISSING_FRONTMATTER
- INVALID_FRONTMATTER
- MISSING_FIELD
- INVALID_TIMESTAMP
- INVALID_TAGS
- INVALID_SOURCE

Storage errors → ErrorCode.InternalError:
- STORAGE_ERROR