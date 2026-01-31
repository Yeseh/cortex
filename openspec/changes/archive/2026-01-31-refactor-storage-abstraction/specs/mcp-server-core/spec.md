## ADDED Requirements

### Requirement: Storage factory injection

The MCP server SHALL accept an optional `StorageFactory` in its configuration, defaulting to `FilesystemStorageFactory` when not provided.

#### Scenario: Default factory behavior

- **WHEN** the server starts without a custom storage factory configured
- **THEN** it uses `FilesystemStorageFactory` to create storage adapters
- **AND** behavior is identical to the current implementation

#### Scenario: Custom factory injection

- **WHEN** a custom `StorageFactory` is provided in server configuration
- **THEN** the server uses that factory for all storage adapter creation
- **AND** MCP tools receive adapters from the injected factory

#### Scenario: Factory used for tool operations

- **WHEN** an MCP memory or category tool needs to access storage
- **THEN** it obtains an adapter via `storageFactory.createAdapter(storeRoot)`
- **AND** does not directly instantiate `FilesystemStorageAdapter`
