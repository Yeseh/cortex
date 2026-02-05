---
created_at: 2026-02-05T19:13:12.788Z
updated_at: 2026-02-05T19:13:12.788Z
tags:
  - map
  - server
  - mcp
source: mcp
---
# Server Package (@yeseh/cortex-server)

**Path**: packages/server
**Purpose**: MCP (Model Context Protocol) server for AI agent integration

## Purpose
Exposes Cortex functionality as MCP tools that AI agents can invoke

## Tool Categories
- `memory/` - Memory MCP tools (add, get, update, remove, move, list, prune)
- `category/` - Category MCP tools (create, delete, set-description)
- `store/` - Store MCP tools (list, create)

## Entry Point
- `src/index.ts` - MCP server startup

## Dependencies
- @yeseh/cortex-core: Domain logic
- @yeseh/cortex-storage-fs: Storage implementation
- @modelcontextprotocol/sdk: MCP protocol
- express: HTTP server (for HTTP transport)
- zod: Input validation