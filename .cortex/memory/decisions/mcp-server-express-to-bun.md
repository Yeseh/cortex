---
created_at: 2026-02-15T11:32:04.375Z
updated_at: 2026-02-15T11:57:56.423Z
tags:
  - decision
  - mcp-server
  - bun
  - express
  - migration
  - archived
source: mcp
---
# Decision: Migrate MCP Server from Express to Bun.serve

## Date
2026-02-15

## Status
Implemented and Archived

## Context
The MCP server used Express 5.x as its HTTP framework. Since Cortex runs exclusively on Bun, we could leverage Bun's native HTTP server capabilities.

## Decision
Replace Express with `Bun.serve` using:
- Routes object for endpoint routing
- `WebStandardStreamableHTTPServerTransport` for MCP protocol
- Web Standard `Response` objects throughout

## Consequences

### Positive
- Removed ~1.3MB of dependencies (express + @types/express)
- Better performance (~2.5x requests/second improvement)
- Simpler architecture using Web Standard APIs
- Better alignment with MCP SDK design

### Breaking Changes
- `CortexServer.app` and `CortexServer.httpServer` removed
- Replaced with `CortexServer.server` (Bun.serve return type)

### Migration Notes
- External API unchanged (endpoints, environment variables)
- All 251 tests passing
- Body size limit preserved (1MB max)

## Pull Request
https://github.com/Yeseh/cortex/pull/28

## Archive
Archived as `2026-02-15-migrate-to-bun-http` on 2026-02-15