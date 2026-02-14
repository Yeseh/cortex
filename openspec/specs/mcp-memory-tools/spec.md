# mcp-memory-tools Specification

## Purpose

MCP tools for AI agents to manage persistent memories. Provides CRUD operations on memories via the Model Context Protocol, with auto-creation of stores and categories.
## Requirements
### Requirement: Add memory tool

The MCP server SHALL provide an `add_memory` tool that creates a new memory with auto-creation of stores and categories. The tool SHALL accept an optional `citations` parameter — an array of strings referencing source material.

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

- **WHEN** an agent provides `tags`, `expires_at`, and `citations` parameters
- **THEN** the memory is created with the specified metadata

#### Scenario: Adding a memory with citations

- **WHEN** an agent calls `add_memory` with `citations: ["src/core/types.ts:17", "https://docs.example.com"]`
- **THEN** the memory is created with those citations in its metadata

### Requirement: Get memory tool

The MCP server SHALL provide a `get_memory` tool that retrieves memory content and metadata. The response SHALL include the memory's `citations` array.

#### Scenario: Retrieving a memory

- **WHEN** an agent calls `get_memory` with a valid path
- **THEN** the memory content and metadata are returned

#### Scenario: Memory not found

- **WHEN** an agent calls `get_memory` with a non-existent path
- **THEN** an appropriate error is returned

#### Scenario: Expired memory handling

- **WHEN** an agent calls `get_memory` with `include_expired: false` (default)
- **THEN** expired memories are not returned

#### Scenario: Response includes citations

- **WHEN** an agent calls `get_memory` for a memory with citations
- **THEN** the response metadata includes the `citations` array

#### Scenario: Response for memory without citations

- **WHEN** an agent calls `get_memory` for a memory without citations
- **THEN** the response metadata includes `citations` as an empty array

### Requirement: Update memory tool

The MCP server SHALL provide an `update_memory` tool that modifies memory content or metadata. The tool SHALL accept an optional `citations` parameter with overwrite semantics.

#### Scenario: Updating content

- **WHEN** an agent calls `update_memory` with new content
- **THEN** the memory content is updated and timestamps are refreshed

#### Scenario: Updating metadata only

- **WHEN** an agent calls `update_memory` with only tags or expiry changes
- **THEN** only the metadata is updated

#### Scenario: Clearing expiry

- **WHEN** an agent calls `update_memory` with `clear_expiry: true`
- **THEN** the expiry date is removed from the memory

#### Scenario: Updating citations

- **WHEN** an agent calls `update_memory` with `citations: ["new/path.ts:5"]`
- **THEN** the citations array is replaced with the provided value

#### Scenario: Clearing citations

- **WHEN** an agent calls `update_memory` with `citations: []`
- **THEN** all citations are removed from the memory

#### Scenario: Preserving citations on unrelated update

- **WHEN** an agent calls `update_memory` without a `citations` parameter
- **THEN** the existing citations are preserved

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

The MCP server SHALL provide a `list_memories` tool that lists memories in a category. Each memory entry in the response SHALL include an optional `updated_at` field sourced from the category index.

#### Scenario: Listing category contents

- **WHEN** an agent calls `list_memories` with a category path
- **THEN** all memories in that category are returned

#### Scenario: Listing all memories

- **WHEN** an agent calls `list_memories` without a category
- **THEN** memories at the root level are returned

#### Scenario: Filtering expired

- **WHEN** an agent calls `list_memories` with `include_expired: true`
- **THEN** expired memories are included in the results

#### Scenario: Response includes updated_at

- **WHEN** `list_memories` returns memory entries
- **THEN** each entry includes `updated_at` (ISO 8601 string or null) sourced from the index

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

### Requirement: Reindex store tool

The MCP server SHALL provide a `reindex_store` tool that rebuilds category indexes for a store.

#### Scenario: Reindex store indexes

- **WHEN** an agent calls `reindex_store` with a valid store name
- **THEN** category indexes for the store are rebuilt
- **AND** the tool returns success with the store path that was reindexed

#### Scenario: Store not found

- **WHEN** an agent calls `reindex_store` with a non-existent store name
- **THEN** an appropriate error is returned indicating the store is not registered

#### Scenario: Reindex failure

- **WHEN** an agent calls `reindex_store` and the reindex operation fails
- **THEN** an appropriate error is returned with the failure message

### Requirement: Get recent memories tool

The MCP server SHALL provide a `cortex_get_recent_memories` tool that retrieves the most recently updated memories from a store, sorted by recency, with full content included.

#### Scenario: Retrieving recent memories store-wide

- **WHEN** an agent calls `cortex_get_recent_memories` with only a `store` parameter
- **THEN** the tool returns up to `limit` memories (default 5) from across all categories
- **AND** memories are sorted by `updated_at` descending (most recent first)
- **AND** each memory includes its full content (raw markdown, no frontmatter)

#### Scenario: Scoping to a category

- **WHEN** an agent calls `cortex_get_recent_memories` with a `category` parameter
- **THEN** only memories within that category and its subcategories are considered

#### Scenario: Custom limit

- **WHEN** an agent calls `cortex_get_recent_memories` with `limit: 10`
- **THEN** at most 10 memories are returned

#### Scenario: Fewer memories than limit

- **WHEN** the store contains fewer memories than the requested limit
- **THEN** all available memories are returned
- **AND** `count` reflects the actual number

#### Scenario: Empty store or category

- **WHEN** the target store or category contains no memories
- **THEN** the tool returns an empty array with `count: 0`

#### Scenario: Non-existent category

- **WHEN** an agent calls `cortex_get_recent_memories` with a category that does not exist
- **THEN** an appropriate error is returned (consistent with `list_memories`)

#### Scenario: Filtering expired memories

- **WHEN** an agent calls `cortex_get_recent_memories` with `include_expired: false` (default)
- **THEN** expired memories are excluded before sorting and limiting

#### Scenario: Including expired memories

- **WHEN** an agent calls `cortex_get_recent_memories` with `include_expired: true`
- **THEN** expired memories are included in the results

#### Scenario: Stale index entries without updatedAt

- **WHEN** some index entries are missing `updatedAt` (stale indexes)
- **THEN** those memories sort last (after all entries with timestamps)

#### Scenario: Response format

- **WHEN** the tool returns successfully
- **THEN** the response includes `category` (path or "all"), `count`, and a `memories` array
- **AND** each memory entry includes `path`, `content`, `updated_at`, `token_estimate`, and `tags`

