## 1. MCP Transport Migration

- [x] 1.1 Update `mcp.ts` imports to use `WebStandardStreamableHTTPServerTransport`
- [x] 1.2 Update `McpContext.transport` type
- [x] 1.3 Update `createMcpTransport()` to return WebStandard transport
- [x] 1.4 Update `mcp.spec.ts` tests for new transport type
- [x] 1.5 Update JSDoc examples in `mcp.ts`

## 2. Health Endpoint Migration

- [x] 2.1 Rewrite `createHealthRouter` to `createHealthResponse` returning `Promise<Response>`
- [x] 2.2 Remove Express Router/Request/Response imports
- [x] 2.3 Update `health.spec.ts` to test with Bun.serve
- [x] 2.4 Update JSDoc examples in `health.ts`

## 3. Main Server Migration

- [x] 3.1 Remove Express imports from `index.ts`
- [x] 3.2 Replace `express()` with `Bun.serve()` configuration
- [x] 3.3 Update `CortexServer` interface (remove app/httpServer, add server)
- [x] 3.4 Update `/mcp` route to call `transport.handleRequest(req)`
- [x] 3.5 Update `/health` route to call `createHealthResponse(config)`
- [x] 3.6 Update graceful shutdown to use `server.stop()`
- [x] 3.7 Update JSDoc examples in `index.ts`
- [x] 3.8 Add 1MB body size limit to `/mcp` endpoint (code review finding)

## 4. Dependencies Cleanup

- [x] 4.1 Remove `express` from dependencies in `package.json`
- [x] 4.2 Remove `@types/express` from devDependencies
- [x] 4.3 Run `bun install` to update lockfile

## 5. Verification

- [x] 5.1 Run `bun test packages/server` - all 251 tests pass
- [x] 5.2 Run `bun run typecheck` - no type errors
- [x] 5.3 Run `bun run lint` - no lint errors (only pre-existing warnings)
- [x] 5.4 Manual test: start server and verify /health works
- [x] 5.5 Manual test: verify MCP endpoint responds correctly
