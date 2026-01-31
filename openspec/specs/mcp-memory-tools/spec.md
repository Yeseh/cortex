# mcp-memory-tools Specification

## Purpose

MCP tools for AI agents to manage persistent memories. Provides CRUD operations on memories via the Model Context Protocol, with auto-creation of stores and categories.

## Requirements

### Requirement: Add memory tool

The MCP server SHALL provide an `add_memory` tool that creates a new memory with auto-creation of stores and categories.

#### Scenario: Adding a memory

- **WHEN** an agent calls `add_memory` with path and content
- **THEN** a new memory is created at the specified path

#### Scenario: Auto-create store on first write

- **WHEN** an agent calls `add_memory` targeting a non-existent store
- **THEN** the store is automatically created before adding the memory

#### Scenario: Auto-create category

- **WHEN** an agent calls `add_memory` with a path in a non-existent category
- **THEN** the category is automatically created

#### Scenario: Memory with optional parameters

- **WHEN** an agent provides `tags` and `expires_at` parameters
- **THEN** the memory is created with the specified metadata

### Requirement: Get memory tool

The MCP server SHALL provide a `get_memory` tool that retrieves memory content and metadata.

#### Scenario: Retrieving a memory

- **WHEN** an agent calls `get_memory` with a valid path
- **THEN** the memory content and metadata are returned

#### Scenario: Memory not found

- **WHEN** an agent calls `get_memory` with a non-existent path
- **THEN** an appropriate error is returned

#### Scenario: Expired memory handling

- **WHEN** an agent calls `get_memory` with `include_expired: false` (default)
- **THEN** expired memories are not returned

### Requirement: Update memory tool

The MCP server SHALL provide an `update_memory` tool that modifies memory content or metadata.

#### Scenario: Updating content

- **WHEN** an agent calls `update_memory` with new content
- **THEN** the memory content is updated and timestamps are refreshed

#### Scenario: Updating metadata only

- **WHEN** an agent calls `update_memory` with only tags or expiry changes
- **THEN** only the metadata is updated

#### Scenario: Clearing expiry

- **WHEN** an agent calls `update_memory` with `clear_expiry: true`
- **THEN** the expiry date is removed from the memory

### Requirement: Remove memory tool

The MCP server SHALL provide a `remove_memory` tool that deletes a memory.

#### Scenario: Removing a memory

- **WHEN** an agent calls `remove_memory` with a valid path
- **THEN** the memory is deleted

#### Scenario: Removing non-existent memory

- **WHEN** an agent calls `remove_memory` with a non-existent path
- **THEN** an appropriate error is returned

### Requirement: Move memory tool

The MCP server SHALL provide a `move_memory` tool that moves or renames a memory.

#### Scenario: Moving a memory

- **WHEN** an agent calls `move_memory` with source and destination paths
- **THEN** the memory is moved to the new location

#### Scenario: Moving to existing path

- **WHEN** an agent calls `move_memory` with a destination that already exists
- **THEN** an appropriate error is returned

### Requirement: List memories tool

The MCP server SHALL provide a `list_memories` tool that lists memories in a category.

#### Scenario: Listing category contents

- **WHEN** an agent calls `list_memories` with a category path
- **THEN** all memories in that category are returned

#### Scenario: Listing all memories

- **WHEN** an agent calls `list_memories` without a category
- **THEN** memories at the root level are returned

#### Scenario: Filtering expired

- **WHEN** an agent calls `list_memories` with `include_expired: true`
- **THEN** expired memories are included in the results

### Requirement: Prune memories tool

The MCP server SHALL provide a `prune_memories` tool that deletes all expired memories.

#### Scenario: Pruning expired memories

- **WHEN** an agent calls `prune_memories`
- **THEN** all expired memories in the store are deleted

#### Scenario: No expired memories

- **WHEN** an agent calls `prune_memories` and no memories are expired
- **THEN** the tool returns success with a count of zero

### Requirement: Required store parameter

All memory tools SHALL require an explicit `store` parameter. The tools SHALL NOT fall back to a default store when the parameter is omitted. Tools SHALL resolve the store name to a filesystem path using the store registry.

#### Scenario: Store parameter required

- **WHEN** an agent calls any memory tool without the `store` parameter
- **THEN** the tool returns a validation error indicating store is required

#### Scenario: Explicit store accepted

- **WHEN** an agent calls a memory tool with an explicit `store` parameter
- **THEN** the tool looks up the store path in the registry and uses that path for the operation

#### Scenario: Store not in registry

- **WHEN** an agent calls a memory tool with a store name not found in the registry
- **THEN** the tool returns an error indicating the store is not registered

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
