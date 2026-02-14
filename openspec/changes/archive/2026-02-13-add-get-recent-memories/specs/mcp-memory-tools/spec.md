## ADDED Requirements

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

## MODIFIED Requirements

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
