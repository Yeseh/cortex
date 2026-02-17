---
{created_at: 2026-02-17T19:14:40.635Z,updated_at: 2026-02-17T19:14:40.635Z,tags: [standard,mcp,entrypoint,thin-wrapper],source: mcp}
---
# MCP Thin Wrapper Pattern

## Rule
MCP tools must be thin wrappers: validate input with Zod, call core operations, and format MCP responses. No filesystem calls or business logic in MCP tools.

## Anti-patterns
- MCP tools that `mkdir`/`read`/`write` files directly
- Duplicating core validation/coordination logic
- Business logic in the transport layer

Core is the single source of truth.