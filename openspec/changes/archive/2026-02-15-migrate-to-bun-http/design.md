## Context

The MCP server uses Express as an HTTP framework, but Cortex is a Bun-only project. The MCP SDK provides both Node.js-compatible (`StreamableHTTPServerTransport`) and Web Standard-compatible (`WebStandardStreamableHTTPServerTransport`) transports.

### Stakeholders

- MCP server users (no change to external API)
- Developers maintaining the server package

### Constraints

- Bun version: 1.2.3+ required for `routes` object support
- MCP SDK version: 1.25.3 (already includes WebStandardStreamableHTTPServerTransport)
- Must maintain 100% backward compatibility for external interfaces

## Goals / Non-Goals

### Goals

- Remove Express dependency completely
- Use Bun's native HTTP server via `Bun.serve`
- Use `WebStandardStreamableHTTPServerTransport` for MCP protocol
- Maintain all existing functionality (health checks, configuration, graceful shutdown)
- Pass all existing tests with updated implementations

### Non-Goals

- Adding new endpoints or features
- Changing the public API or environment variables
- Supporting Node.js (Cortex is Bun-only)
- Adding SSE support for GET /mcp (future enhancement)

## Decisions

### Decision 1: Use `Bun.serve` with routes object

**What**: Use `Bun.serve` with the `routes` configuration for endpoint routing.

**Why**:

- Built-in routing eliminates need for external router
- Cleaner than manual URL parsing in `fetch` handler
- Type-safe with Bun's types

**Example**:

```typescript
Bun.serve({
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

### Decision 2: Use WebStandardStreamableHTTPServerTransport

**What**: Replace `StreamableHTTPServerTransport` with `WebStandardStreamableHTTPServerTransport`.

**Why**:

- Native Web Standard API support (Request/Response)
- No adapter overhead (the Node.js transport wraps this one anyway)
- Explicit SDK support for Bun

**Import change**:

```typescript
// Before
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// After
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
```

### Decision 3: Health endpoint as pure function

**What**: Replace Express Router with a simple async function returning a Response.

**Why**:

- No router abstraction needed
- Directly returns Web Standard Response
- Simpler, more testable

**Example**:

```typescript
export const createHealthResponse = async (config: ServerConfig): Promise<Response> => {
    // ... logic
    return Response.json(response);
};
```

### Decision 4: Server interface changes

**What**: Update `CortexServer` interface to expose Bun server instead of Express.

**Why**: Reflects actual implementation while maintaining the same external API.

**Changes**:

```typescript
export interface CortexServer {
    server: ReturnType<typeof Bun.serve>; // was: app: Express; httpServer: Server;
    mcpContext: McpContext;
    config: ServerConfig;
    close: () => Promise<void>;
}
```

### Alternatives Considered

1. **Hono.js**: Lightweight framework that works with Bun. Rejected because we'd still have an external dependency and Bun.serve is sufficient.

2. **Manual fetch handler**: Parse URLs in a single `fetch` function. Rejected because `routes` object is cleaner and built-in.

3. **Keep Express with Bun adapter**: Express works with Bun. Rejected because it adds unnecessary dependency and adapter overhead.

## Risks / Trade-offs

| Risk                             | Mitigation                                            |
| -------------------------------- | ----------------------------------------------------- |
| Bun.serve API changes            | Pin Bun version in docs; API is stable since 1.0      |
| Test flakiness with real servers | Same approach as current Express tests; proven stable |
| Missing Express middleware       | Only JSON body parsing used; Bun handles natively     |

## Migration Plan

1. Update `mcp.ts` to use WebStandardStreamableHTTPServerTransport
2. Rewrite `health.ts` as pure function
3. Rewrite `index.ts` to use Bun.serve
4. Update all tests
5. Remove Express from package.json
6. Verify all tests pass
7. Update JSDoc examples

## Open Questions

None - all decisions are straightforward given the constraints.
