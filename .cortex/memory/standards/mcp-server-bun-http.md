---
created_at: 2026-02-15T11:31:57.455Z
updated_at: 2026-02-15T11:31:57.455Z
tags:
  - mcp-server
  - bun
  - http
  - patterns
  - architecture
source: mcp
---
# MCP Server: Bun HTTP Server Pattern

## Overview
The MCP server uses Bun's native HTTP server (`Bun.serve`) instead of Express.js for better performance and reduced dependencies.

## Key Patterns

### Server Setup
```typescript
const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    routes: {
        '/mcp': {
            POST: async (req) => transport.handleRequest(req),
        },
        '/health': {
            GET: async () => createHealthResponse(config),
        },
    },
    fetch: () => new Response('Not Found', { status: 404 }),
});
```

### Transport
Use `WebStandardStreamableHTTPServerTransport` from MCP SDK:
```typescript
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
```

This returns `Response` objects directly, no Express req/res needed.

### Body Size Limits
Check Content-Length header manually:
```typescript
const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
if (contentLength > 1024 * 1024) {
    return Response.json({ error: 'Request body too large' }, { status: 413 });
}
```

### Health Endpoint
Pure function returning `Response`:
```typescript
export const createHealthResponse = async (config: ServerConfig): Promise<Response> => {
    return Response.json({ status: 'healthy', version: SERVER_VERSION, ... });
};
```

## Benefits
- No Express dependency (~1.3MB saved)
- Native Bun performance
- Web Standard APIs (Request/Response)
- Better MCP SDK alignment