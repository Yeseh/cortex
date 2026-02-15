## MODIFIED Requirements

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
