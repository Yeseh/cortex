# mcp-server-core Specification

## Purpose
TBD - created by archiving change add-mcp-server-core. Update Purpose after archive.
## Requirements
### Requirement: Streamable HTTP transport

The MCP server SHALL expose MCP protocol messages via Streamable HTTP transport at the `/mcp` endpoint using Bun's native HTTP server and the MCP SDK's `WebStandardStreamableHTTPServerTransport`.

#### Scenario: MCP message handling

- **WHEN** a POST request with an MCP message is sent to `/mcp`
- **THEN** the server processes the message via `WebStandardStreamableHTTPServerTransport.handleRequest()` and returns an MCP response

#### Scenario: Invalid MCP message

- **WHEN** a malformed MCP message is received
- **THEN** the server returns an appropriate MCP error response

#### Scenario: Unsupported HTTP methods

- **WHEN** a GET, PUT, PATCH, or DELETE request is sent to `/mcp`
- **THEN** the server returns 405 Method Not Allowed

### Requirement: Environment-based configuration

The MCP server SHALL be fully configurable via environment variables without requiring config files. The default store name SHALL be `'default'`.

#### Scenario: Server starts with defaults

- **WHEN** the server starts without environment variables set
- **THEN** the server uses default values for all configuration options including `defaultStore: 'default'`, `logLevel: 'info'`, and `otelEnabled: false`

#### Scenario: Custom configuration

- **WHEN** environment variables are set (e.g., `CORTEX_PORT=8080`)
- **THEN** the server uses the provided values

#### Scenario: Invalid configuration

- **WHEN** an invalid value is provided (e.g., `CORTEX_PORT=not-a-number`)
- **THEN** the server fails to start with a clear error message

#### Scenario: Default store name

- **WHEN** `CORTEX_DEFAULT_STORE` is not set
- **THEN** the server uses `'default'` as the default store name

#### Scenario: OTel enabled via env var

- **WHEN** `CORTEX_OTEL_ENABLED=true` is set
- **THEN** the server bootstraps OTel providers and emits spans and log records to the console exporter

#### Scenario: Log level configured via env var

- **WHEN** `CORTEX_LOG_LEVEL=debug` is set
- **THEN** debug-level log records are emitted; when `CORTEX_LOG_LEVEL=warn`, only warn and error records are emitted

### Requirement: Health check endpoint

The MCP server SHALL provide a `/health` endpoint for container orchestration and monitoring, served directly by Bun's native HTTP server.

#### Scenario: Health check success

- **WHEN** a GET request is sent to `/health`
- **THEN** the server returns a JSON response with status, version, data path, and store count

#### Scenario: Health check during startup

- **WHEN** the server is still initializing
- **THEN** the health endpoint is not available until startup completes

#### Scenario: Unsupported methods on health

- **WHEN** a POST, PUT, PATCH, or DELETE request is sent to `/health`
- **THEN** the server returns 404 Not Found (unmatched route)

### Requirement: Domain error translation

The MCP server SHALL translate domain `Result` errors into MCP-compatible error responses.

#### Scenario: Domain error mapping

- **WHEN** a domain operation returns an error Result
- **THEN** the error is translated to an MCP error with appropriate code and message

#### Scenario: Validation error formatting

- **WHEN** input validation fails (via Zod)
- **THEN** the validation errors are formatted consistently in the MCP error response

