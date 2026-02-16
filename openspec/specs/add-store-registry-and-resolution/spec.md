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

### Requirement: Cortex Class

The system SHALL provide a `Cortex` class as the root client for the memory system. The class SHALL include:

1. `static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>` - Load from filesystem
2. `static init(options: CortexOptions): Cortex` - Create programmatically (sync, no filesystem)
3. `initialize(): Promise<Result<void, InitializeError>>` - Create folder structure (idempotent)
4. `getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>` - Factory for store adapters
5. `readonly rootDirectory: string` - Config directory path
6. `readonly settings: CortexSettings` - Current settings
7. `readonly registry: Registry` - Store definitions

#### Scenario: Create Cortex from config file

- **GIVEN** a valid config file at `~/.config/cortex/config.yaml`
- **WHEN** `Cortex.fromConfig('~/.config/cortex')` is called
- **THEN** it returns `Result.ok(cortex)` with settings and registry loaded

#### Scenario: Create Cortex from config - missing file

- **GIVEN** no config file exists at the specified path
- **WHEN** `Cortex.fromConfig(path)` is called
- **THEN** it returns error with code `CONFIG_NOT_FOUND`

#### Scenario: Create Cortex programmatically

- **GIVEN** valid `CortexOptions` with `rootDirectory`
- **WHEN** `Cortex.init(options)` is called
- **THEN** it returns a `Cortex` instance synchronously
- **AND** no filesystem operations occur

#### Scenario: Cortex init with defaults

- **GIVEN** only `rootDirectory` is provided in options
- **WHEN** `Cortex.init({ rootDirectory })` is called
- **THEN** default settings are used
- **AND** registry is empty
- **AND** default adapter factory (filesystem) is used

#### Scenario: Cortex init with custom adapter factory

- **GIVEN** options include `adapterFactory` function
- **WHEN** `Cortex.init(options)` is called
- **AND** `getStore(name)` is called
- **THEN** the custom factory is used to create adapters

#### Scenario: Initialize creates folder structure

- **GIVEN** a `Cortex` instance with `rootDirectory` that doesn't exist
- **WHEN** `initialize()` is called
- **THEN** the directory structure is created
- **AND** `config.yaml` is written with current settings and registry

#### Scenario: Initialize is idempotent

- **GIVEN** a `Cortex` instance where `rootDirectory` already exists with config
- **WHEN** `initialize()` is called
- **THEN** it succeeds without error
- **AND** existing config is preserved

#### Scenario: Get store returns scoped adapter

- **GIVEN** a Cortex instance with store "my-project" in registry
- **WHEN** `getStore("my-project")` is called
- **THEN** it returns `Result<ScopedStorageAdapter, StoreNotFoundError>`
- **AND** the adapter is scoped to the store's path

#### Scenario: Get store for unknown store

- **GIVEN** a Cortex instance without store "unknown" in registry
- **WHEN** `getStore("unknown")` is called
- **THEN** it returns error with code `STORE_NOT_FOUND`

### Requirement: CortexOptions interface

The system SHALL provide a `CortexOptions` interface for programmatic Cortex creation:

- `rootDirectory: string` (required) - Path to config directory
- `settings?: Partial<CortexSettings>` (optional) - Override default settings
- `registry?: Registry` (optional) - Store definitions (default: empty)
- `adapterFactory?: AdapterFactory` (optional) - Custom adapter creation (default: filesystem)

#### Scenario: Options with all fields

- **WHEN** `CortexOptions` includes all fields
- **THEN** all values are used as specified

#### Scenario: Options with only rootDirectory

- **WHEN** `CortexOptions` includes only `rootDirectory`
- **THEN** default settings, empty registry, and filesystem adapter factory are used

### Requirement: Registry type (renamed from StoreRegistry)

The `StoreRegistry` type SHALL be renamed to `Registry` to represent the collection of store definitions.

#### Scenario: Registry type definition

- **WHEN** the `Registry` type is used
- **THEN** it is `Record<string, StoreDefinition>`
- **AND** `StoreDefinition` has `path: string` and optional `description?: string`

