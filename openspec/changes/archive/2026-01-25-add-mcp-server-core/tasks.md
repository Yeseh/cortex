# Tasks: Add MCP Server Core Infrastructure

## 1. Project Setup

- [x] 1.1 Add dependencies: `@modelcontextprotocol/sdk`, `zod`, `express`
- [x] 1.2 Create `src/server/` directory structure

## 2. Configuration

- [x] 2.1 Implement `src/server/config.ts` - environment variable parsing
- [x] 2.2 Support all config variables: `CORTEX_DATA_PATH`, `CORTEX_PORT`, `CORTEX_HOST`, `CORTEX_DEFAULT_STORE`, `CORTEX_LOG_LEVEL`, `CORTEX_OUTPUT_FORMAT`, `CORTEX_AUTO_SUMMARY_THRESHOLD`

## 3. MCP Server Setup

- [x] 3.1 Implement `src/server/mcp.ts` - MCP server instance and Streamable HTTP transport
- [x] 3.2 Configure transport for stateless operation at `/mcp` endpoint

## 4. Error Handling

- [x] 4.1 Implement `src/server/errors.ts` - domain Result errors to MCP error translation
- [x] 4.2 Define consistent error code mapping

## 5. Health Endpoint

- [x] 5.1 Implement `src/server/health.ts` - `/health` endpoint
- [x] 5.2 Return status, version, dataPath, and storeCount

## 6. Entry Point

- [x] 6.1 Implement `src/server/index.ts` - Express setup and server startup
- [x] 6.2 Wire up MCP transport and health endpoint

## 7. Testing

- [x] 7.1 Write unit tests for config parsing
- [x] 7.2 Write integration tests for health endpoint
- [x] 7.3 Write integration tests for MCP transport setup
