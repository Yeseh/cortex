# add-store-registry-and-resolution Specification

## Purpose

Defines the store registry format, resolution behavior, and abstraction interfaces for managing multiple memory stores.

## Requirements

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

### Requirement: Store registry format

The system SHALL store named store definitions in a YAML registry file that maps store names to path values and optional descriptions.

#### Scenario: Registry format with top-level mapping

- **WHEN** the registry file contains store names as top-level keys
- **THEN** each store name maps to its configured path value

#### Scenario: Registry format with stores section

- **WHEN** the registry file contains a top-level `stores` mapping
- **THEN** the system reads store names from the `stores` mapping

#### Scenario: Path value requirements

- **WHEN** a store entry is parsed
- **THEN** the store path MUST be a non-empty string value

#### Scenario: Missing path value

- **WHEN** a store entry omits its path value or provides a non-string value
- **THEN** the system returns a registry format error

#### Scenario: Duplicate store names

- **WHEN** a store name is defined more than once in the registry
- **THEN** the system returns a duplicate name error

#### Scenario: Inline comments

- **WHEN** the registry file includes YAML comments on the same line as a store entry
- **THEN** the system ignores the comments and reads the store name and path value

#### Scenario: Optional description field

- **WHEN** a store entry includes a `description` field
- **THEN** the system stores the description as metadata for the store

#### Scenario: Description field omitted

- **WHEN** a store entry omits the `description` field
- **THEN** the system treats the description as undefined (no error)

### Requirement: Store resolution behavior

The system SHALL resolve stores by checking a local .cortex directory first and falling back to the global registry only when strict_local is false.

#### Scenario: Local store precedence

- **WHEN** a local registry defines the requested store name
- **THEN** the system resolves the store using the local registry entry

#### Scenario: Strict local resolution

- **WHEN** strict_local is true and no local store exists
- **THEN** the system returns a resolution error

#### Scenario: Global fallback when strict_local is false

- **WHEN** strict_local is false and the local registry does not define the store
- **THEN** the system attempts to resolve the store from the global registry

#### Scenario: Global registry missing

- **WHEN** strict_local is false, the local registry does not define the store, and the global registry is missing
- **THEN** the system returns a global registry missing error

#### Scenario: Global store missing

- **WHEN** strict_local is false, the local registry does not define the store, and the global registry lacks the store name
- **THEN** the system returns a resolution error

### Requirement: List stores MCP tool

The MCP server SHALL provide a `cortex_list_stores` tool that returns all registered stores with their metadata.

#### Scenario: Listing available stores

- **WHEN** an agent calls `cortex_list_stores`
- **THEN** the tool returns a list of stores with name, path, and description for each

#### Scenario: Store without description

- **WHEN** a store has no description configured
- **THEN** the store is included in the list with description omitted or null

#### Scenario: Empty registry

- **WHEN** no stores are registered
- **THEN** the tool returns an empty list
