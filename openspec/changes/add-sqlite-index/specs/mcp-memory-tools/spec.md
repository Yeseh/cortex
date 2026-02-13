## ADDED Requirements

### Requirement: Query memories tool

The MCP server SHALL provide a `cortex_query_memories` tool that queries memories by filter criteria using the SQLite index.

#### Scenario: Query by tags

- **WHEN** an agent calls `cortex_query_memories` with `tags: ['architecture']`
- **THEN** memories matching any of the specified tags are returned

#### Scenario: Query by category scope

- **WHEN** an agent calls `cortex_query_memories` with `category: 'decisions'`
- **THEN** memories in `decisions` and all subcategories are returned

#### Scenario: Query by date range

- **WHEN** an agent calls `cortex_query_memories` with `updated_after` and `updated_before`
- **THEN** only memories updated within the date range are returned

#### Scenario: Query with sort and pagination

- **WHEN** an agent calls `cortex_query_memories` with `sort_by`, `sort_order`, `limit`, and `offset`
- **THEN** results are sorted and paginated accordingly

#### Scenario: Query with combined filters

- **WHEN** an agent calls `cortex_query_memories` with multiple filter parameters
- **THEN** all filters are applied (AND semantics between filter types, OR within tags)

## MODIFIED Requirements

### Requirement: Get recent memories tool

The MCP server SHALL provide a `cortex_get_recent_memories` tool that retrieves the N most recently updated memories. The tool SHALL be reimplemented internally using `IndexStorage.query()` with `sortBy: 'updatedAt'`, `sortOrder: 'desc'`, and the requested `limit`.

#### Scenario: Get recent memories

- **WHEN** an agent calls `cortex_get_recent_memories` with `limit: 5`
- **THEN** the 5 most recently updated memories are returned
- **AND** the implementation delegates to the query interface internally

#### Scenario: Scoped to category

- **WHEN** an agent calls `cortex_get_recent_memories` with `category: 'decisions'`
- **THEN** only recent memories within that category tree are returned
