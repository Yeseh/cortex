# Migrate to Bun HTTP Implementation Plan

**Goal:** Replace Express with Bun's native HTTP server for better performance and reduced dependencies
**Architecture:** Use `Bun.serve` with routes object for endpoint routing, `WebStandardStreamableHTTPServerTransport` for MCP protocol
**Tech Stack:** Bun 1.3.6+, MCP SDK 1.25.3, TypeScript 5.x
**Session Id:** ses_39ef71e64ffeGLb4weCCfzbKr2

---

## Overview

This migration replaces Express.js with Bun's native HTTP server in the MCP server package. The change is internal - external API (endpoints, environment variables) remains unchanged.

## Task Breakdown

### Task 1: MCP Transport Migration (`packages/server/src/mcp.ts`)

**Goal:** Update transport to use WebStandardStreamableHTTPServerTransport

**Implementation Steps:**

1.1. Update imports:
```typescript
// Change from:
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// To:
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
```

1.2. Update `McpContext.transport` type:
```typescript
export interface McpContext {
    server: McpServer;
    transport: WebStandardStreamableHTTPServerTransport; // Changed from StreamableHTTPServerTransport
}
```

1.3. Update `createMcpTransport()` function:
```typescript
export const createMcpTransport = (): WebStandardStreamableHTTPServerTransport => {
    return new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
    }); 
};
```

1.4. Update JSDoc examples to show Web Standard usage patterns

**Test Updates (`mcp.spec.ts`):**
- Update import to use `WebStandardStreamableHTTPServerTransport`
- Update `instanceof` checks to use new transport type
- All existing test behaviors should remain the same

---

### Task 2: Health Endpoint Migration (`packages/server/src/health.ts`)

**Goal:** Replace Express Router with pure function returning Web Standard Response

**Implementation Steps:**

2.1. Remove Express imports and replace with Web Standard Response:
```typescript
// Remove:
import { Router, type Request, type Response } from 'express';

// No imports needed - Response is global in Bun
```

2.2. Replace `createHealthRouter` with `createHealthResponse`:
```typescript
/**
 * Creates a health check response for container orchestration.
 */
export const createHealthResponse = async (config: ServerConfig): Promise<Response> => {
    const registryPath = resolve(config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();
    const storeCount = registryResult.ok() ? Object.keys(registryResult.value).length : 0;

    const response: HealthResponse = {
        status: 'healthy',
        version: SERVER_VERSION,
        dataPath: config.dataPath,
        storeCount,
    };

    return Response.json(response);
};
```

2.3. Keep `HealthResponse` interface unchanged

**Test Updates (`health.spec.ts`):**
- Remove Express app and router creation
- Use `Bun.serve` with routes object
- Test directly against Bun server
- Update helper functions:
```typescript
const startServer = (config: ServerConfig): { server: ReturnType<typeof Bun.serve>; baseUrl: string } => {
    const server = Bun.serve({
        port: 0, // Random port
        hostname: '127.0.0.1',
        routes: {
            '/health': {
                GET: async () => createHealthResponse(config),
            },
        },
        fetch: () => new Response('Not Found', { status: 404 }),
    });
    return { server, baseUrl: `http://127.0.0.1:${server.port}` };
};
```

---

### Task 3: Main Server Migration (`packages/server/src/index.ts`)

**Goal:** Replace Express with Bun.serve

**Implementation Steps:**

3.1. Remove Express imports:
```typescript
// Remove:
import express, { type Express } from 'express';
import type { Server } from 'node:http';
```

3.2. Update `CortexServer` interface:
```typescript
export interface CortexServer {
    /** Bun HTTP server instance */
    server: ReturnType<typeof Bun.serve>;
    
    /** MCP context containing server and transport */
    mcpContext: McpContext;

    /** Resolved server configuration */
    config: ServerConfig;

    /** Gracefully shuts down the server */
    close: () => Promise<void>;
}
```

3.3. Update `createServer()` to use `Bun.serve`:
```typescript
export const createServer = async (): Promise<Result<CortexServer, ServerStartError>> => {
    // Load config (unchanged)
    const configResult = loadServerConfig();
    if (!configResult.ok()) {
        return err({
            code: 'CONFIG_INVALID',
            message: `Configuration error: ${configResult.error.message}`,
            cause: new Error(configResult.error.message),
        });
    }
    const config = configResult.value;

    // Create MCP context (unchanged)
    const mcpContext = createMcpContext();
    const { server: mcpServer, transport } = mcpContext;

    // Register MCP tools (unchanged)
    registerMemoryTools(mcpServer, config);
    registerStoreTools(mcpServer, config);
    registerCategoryTools(mcpServer, config);

    // Connect MCP server to transport (unchanged)
    await mcpServer.connect(transport);

    // Create Bun HTTP server with routes
    const server = Bun.serve({
        port: config.port,
        hostname: config.host,
        routes: {
            '/mcp': {
                POST: async (req) => {
                    try {
                        return await transport.handleRequest(req);
                    } catch (error) {
                        console.error('MCP request handling error:', error);
                        return Response.json({ error: 'Internal server error' }, { status: 500 });
                    }
                },
            },
            '/health': {
                GET: async () => createHealthResponse(config),
            },
        },
        fetch: () => new Response('Not Found', { status: 404 }),
    });

    console.warn(`Cortex MCP server listening on http://${config.host}:${config.port}`);
    console.warn(`  Data path: ${config.dataPath}`);
    console.warn(`  Default store: ${config.defaultStore}`);
    console.warn('  MCP endpoint: POST /mcp');
    console.warn('  Health check: GET /health');

    // Graceful shutdown handler
    const close = async (): Promise<void> => {
        await mcpServer.close();
        server.stop();
    };

    return ok({ server, mcpContext, config, close });
};
```

3.4. Update JSDoc module description and examples

---

### Task 4: Dependencies Cleanup (`packages/server/package.json`)

4.1. Remove from `dependencies`:
```json
"express": "^5.2.1",
```

4.2. Remove from `devDependencies`:
```json
"@types/express": "^5.0.6"
```

4.3. Run `bun install` to update lockfile

---

### Task 5: Verification

5.1. Run `bun test packages/server` - all tests pass
5.2. Run `bun run typecheck` - no type errors
5.3. Run `bun run lint` - no lint errors
5.4. Manual test: start server and verify /health works
5.5. Manual test: verify MCP endpoint responds correctly

---

## Dependency Map

```
Task 1 (MCP Transport) ──┐
                         ├──> Task 3 (Main Server) ──> Task 4 (Deps) ──> Task 5 (Verify)
Task 2 (Health)        ──┘
```

**Parallel execution:**
- Task 1 and Task 2 can run in parallel
- Task 3 depends on Tasks 1 and 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4

---

## Code Locations

| File | Change Type |
|------|-------------|
| `packages/server/src/mcp.ts` | Modify import and types |
| `packages/server/src/mcp.spec.ts` | Update transport type checks |
| `packages/server/src/health.ts` | Rewrite as pure function |
| `packages/server/src/health.spec.ts` | Rewrite test helpers |
| `packages/server/src/index.ts` | Replace Express with Bun.serve |
| `packages/server/package.json` | Remove express deps |
