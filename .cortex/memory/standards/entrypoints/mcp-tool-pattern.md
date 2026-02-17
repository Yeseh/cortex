---
{created_at: 2026-02-17T19:14:33.427Z,updated_at: 2026-02-17T19:14:33.427Z,tags: [standard,mcp,entrypoint,tool],source: mcp}
---
# MCP Tool Pattern

## Registration
Tool registration uses `server.tool(name, description, inputSchema.shape, handler)` with `parseInput(schema, input)` before delegating to a handler.

## Handler Pattern
1. Resolve store adapter from registry
2. Call core operation
3. Return MCP response object with content array

## Error Handling
- Validation errors map to `InvalidParams`
- Domain errors are translated via domain error mappings (see `standards/errors/mcp-translation`)