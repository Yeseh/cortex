# Change: Migrate MCP server from Express to Bun's native HTTP server

## Why

The MCP server currently uses Express 5.x as its HTTP framework. Since Cortex runs exclusively on Bun, we can leverage Bun's native `Bun.serve` HTTP server to:

1. **Remove dependencies**: Eliminate `express` and `@types/express` (~1.3MB)
2. **Improve performance**: Bun's native server handles ~2.5x more requests per second than Node.js HTTP
3. **Simplify architecture**: Use Web Standard APIs (Request/Response) directly instead of Node.js HTTP adapters
4. **Better MCP SDK alignment**: Use `WebStandardStreamableHTTPServerTransport` which is designed for web-standard runtimes like Bun

## What Changes

- Replace Express app creation with `Bun.serve` configuration
- Switch from `StreamableHTTPServerTransport` to `WebStandardStreamableHTTPServerTransport`
- Rewrite health endpoint as a plain function returning Web Standard `Response`
- Update tests to use Bun.serve instead of Express
- Remove express dependencies from package.json

## Impact

- **Affected specs**: `mcp-server-core`
- **Affected code**:
    - `packages/server/src/index.ts` (main server factory)
    - `packages/server/src/mcp.ts` (MCP transport creation)
    - `packages/server/src/health.ts` (health endpoint)
    - `packages/server/src/health.spec.ts` (tests)
    - `packages/server/package.json` (dependencies)
- **Breaking changes**: None - external API (endpoints, environment variables) unchanged
