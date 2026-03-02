## MODIFIED Requirements

### Requirement: Prune memories tool

The MCP server SHALL provide a `prune_memories` tool that deletes expired memories within a specified scope. When called from a category context, only memories within that subtree are pruned.

#### Scenario: Pruning entire store

- **WHEN** an agent calls `prune_memories` without a category scope
- **THEN** all expired memories in the store are deleted

#### Scenario: Scoped pruning

- **WHEN** an agent calls `prune_memories` from a category client
- **THEN** only expired memories within that category subtree are deleted
- **AND** indexes are reindexed only for the affected scope

#### Scenario: No expired memories

- **WHEN** an agent calls `prune_memories` and no memories are expired in the scope
- **THEN** the tool returns success with a count of zero

#### Scenario: Dry run mode

- **WHEN** an agent calls `prune_memories` with `dry_run: true`
- **THEN** the tool returns what would be pruned without deleting

### Requirement: Reindex store tool

The MCP server SHALL provide a `reindex_store` tool that rebuilds category indexes for a store or category scope. The tool accepts an optional `scope` parameter to limit reindexing to a subtree.

#### Scenario: Reindex entire store

- **WHEN** an agent calls `reindex_store` with only a store name
- **THEN** category indexes for the entire store are rebuilt

#### Scenario: Scoped reindex

- **WHEN** an agent calls `reindex_store` with a `scope` parameter
- **THEN** only indexes within that category subtree are rebuilt

#### Scenario: Store not found

- **WHEN** an agent calls `reindex_store` with a non-existent store name
- **THEN** an appropriate error is returned indicating the store is not registered

#### Scenario: Reindex failure

- **WHEN** an agent calls `reindex_store` and the reindex operation fails
- **THEN** an appropriate error is returned with the failure message
