## ADDED Requirements

### Requirement: Registry Interface

The system SHALL provide a `Registry` interface that abstracts store registry operations independent of storage backend. The interface SHALL include:

1. `initialize()` - First-time registry setup
2. `load()` - Load registry data (caches internally)
3. `save(registry)` - Persist registry data
4. `getStore(name)` - Synchronous factory returning `ScopedStorageAdapter`

#### Scenario: Registry initialization

- **GIVEN** no registry exists
- **WHEN** `initialize()` is called
- **THEN** the registry storage is created
- **AND** subsequent `load()` calls succeed

#### Scenario: Registry caches loaded data

- **GIVEN** a registry with stores configured
- **WHEN** `load()` is called
- **THEN** the registry data is cached internally
- **AND** `getStore(name)` can be called synchronously

#### Scenario: Get store returns scoped adapter

- **GIVEN** a loaded registry with store "my-project"
- **WHEN** `getStore("my-project")` is called
- **THEN** it returns `Result<ScopedStorageAdapter, StoreNotFoundError>`
- **AND** the adapter is scoped to the store's storage location

#### Scenario: Get store for unknown store

- **GIVEN** a loaded registry without store "unknown"
- **WHEN** `getStore("unknown")` is called
- **THEN** it returns error with code `STORE_NOT_FOUND`

### Requirement: Initialize Store Domain Operation

The system SHALL provide an `initializeStore` domain operation that creates a new store with proper structure.

#### Scenario: Initialize new store

- **GIVEN** a registry and valid store name and path
- **WHEN** `initializeStore(registry, name, path)` is called
- **THEN** the store directory structure is created
- **AND** a root index is initialized
- **AND** the store is registered in the registry

#### Scenario: Initialize store with categories

- **GIVEN** a registry and options with categories `["global", "projects"]`
- **WHEN** `initializeStore(registry, name, path, { categories })` is called
- **THEN** the specified category directories are created
- **AND** category indexes are initialized

## MODIFIED Requirements

### Requirement: Store Registry Parsing

The store registry parsing module SHALL be pure (no I/O operations). It SHALL provide:

1. `parseStoreRegistry(raw: string)` - Parse YAML to registry object
2. `serializeStoreRegistry(registry)` - Serialize registry to YAML
3. `isValidStoreName(name)` - Validate store name format
4. `resolveStorePath(registry, name)` - Lookup store path from registry

#### Scenario: Parse valid registry YAML

- **GIVEN** valid YAML with stores section
- **WHEN** `parseStoreRegistry(yaml)` is called
- **THEN** it returns parsed `StoreRegistry` object

#### Scenario: Serialize registry to YAML

- **GIVEN** a `StoreRegistry` object
- **WHEN** `serializeStoreRegistry(registry)` is called
- **THEN** it returns valid YAML string

## REMOVED Requirements

### Requirement: Filesystem-based Store Resolution

**Reason:** Superseded by registry-based `getStore()` factory method.

**Migration:** Use `registry.getStore(name)` instead of `resolveStore()` from `store.ts`.
