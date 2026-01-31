## MODIFIED Requirements

### Requirement: Memory Tool Implementation

MCP memory tools SHALL delegate to domain operations in `src/core/memory/operations.ts` rather than implementing business logic directly. Each tool handler SHALL:

1. Parse and validate input using Zod schemas
2. Obtain a storage adapter for the requested store
3. Call the appropriate domain operation
4. Transform domain errors to MCP errors
5. Format the response for MCP protocol

#### Scenario: Add memory tool delegates to createMemory

- **GIVEN** a valid add_memory request with store, path, content
- **WHEN** the addMemoryHandler processes the request
- **THEN** it calls `createMemory(adapter, path, input)` from domain operations
- **AND** returns MCP-formatted success response

#### Scenario: Get memory tool delegates to getMemory

- **GIVEN** a valid get_memory request with store and path
- **WHEN** the getMemoryHandler processes the request
- **THEN** it calls `getMemory(adapter, path, options)` from domain operations
- **AND** returns MCP-formatted memory content and metadata

#### Scenario: Domain error mapped to MCP error

- **GIVEN** a domain operation returns a MemoryError
- **WHEN** the tool handler receives the error
- **THEN** it maps the error code to appropriate MCP ErrorCode
- **AND** throws McpError with descriptive message
