## ADDED Requirements

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
