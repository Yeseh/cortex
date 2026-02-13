## MODIFIED Requirements

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
