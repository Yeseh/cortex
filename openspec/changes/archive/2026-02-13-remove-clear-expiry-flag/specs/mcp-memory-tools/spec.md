## MODIFIED Requirements

### Requirement: Update memory tool

The MCP server SHALL provide an `update_memory` tool that modifies memory content or metadata.

#### Scenario: Updating content

- **WHEN** an agent calls `update_memory` with new content
- **THEN** the memory content is updated and timestamps are refreshed

#### Scenario: Updating metadata only

- **WHEN** an agent calls `update_memory` with only tags or expiry changes
- **THEN** only the metadata is updated

#### Scenario: Clearing expiry

- **WHEN** an agent calls `update_memory` with `expires_at: null`
- **THEN** the expiry date is removed from the memory
