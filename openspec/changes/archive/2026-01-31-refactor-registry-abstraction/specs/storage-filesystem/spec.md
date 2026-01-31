## ADDED Requirements

### Requirement: ScopedStorageAdapter Interface

The system SHALL provide a `ScopedStorageAdapter` interface representing a storage adapter scoped to a specific store. It SHALL have:

- `memories: MemoryStorage`
- `indexes: IndexStorage`
- `categories: CategoryStorage`

It SHALL NOT include store or registry operations (the adapter is already scoped).

#### Scenario: Scoped adapter provides memory operations

- **GIVEN** a `ScopedStorageAdapter` instance
- **WHEN** accessing `adapter.memories`
- **THEN** it provides `MemoryStorage` interface for the scoped store

## RENAMED Requirements

- FROM: `### Requirement: FilesystemStoreStorage`
- TO: `### Requirement: FilesystemRegistry`

## MODIFIED Requirements

### Requirement: FilesystemRegistry

The system SHALL provide a `FilesystemRegistry` class implementing the `Registry` interface for filesystem-based storage.

#### Scenario: Constructor accepts registry path

- **GIVEN** a filesystem path to store registry
- **WHEN** `new FilesystemRegistry(registryPath)` is called
- **THEN** the instance is configured to use that path

#### Scenario: Initialize creates registry file

- **GIVEN** a `FilesystemRegistry` instance
- **WHEN** `initialize()` is called
- **THEN** the registry file is created at the configured path
- **AND** parent directories are created if needed

#### Scenario: Load reads and caches registry

- **GIVEN** a registry file exists with store definitions
- **WHEN** `load()` is called
- **THEN** the registry is parsed and cached internally
- **AND** the parsed `StoreRegistry` is returned

#### Scenario: Load with missing file

- **GIVEN** no registry file exists
- **WHEN** `load()` is called
- **THEN** it returns error with code `REGISTRY_MISSING`

#### Scenario: Save persists registry

- **GIVEN** a `FilesystemRegistry` instance
- **WHEN** `save(registry)` is called
- **THEN** the registry is serialized and written to the configured path

#### Scenario: GetStore creates FilesystemStorageAdapter

- **GIVEN** a loaded registry with store "default" at path "/home/user/.cortex"
- **WHEN** `getStore("default")` is called
- **THEN** it returns a `FilesystemStorageAdapter` configured for that path
