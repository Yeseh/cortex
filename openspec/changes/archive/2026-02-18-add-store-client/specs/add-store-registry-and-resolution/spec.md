## ADDED Requirements

### Requirement: StoreClient class

The system SHALL provide a `StoreClient` class that wraps a store's storage adapter and provides fluent access to categories. The class SHALL include:

1. `readonly name: string` - Store name
2. `readonly path: string` - Filesystem path to store
3. `readonly description?: string` - Optional store description
4. `rootCategory(): CategoryClient` - Entry point to category tree

#### Scenario: StoreClient exposes metadata

- **GIVEN** a `StoreClient` for store "my-project" at path "/data/my-project"
- **WHEN** the client properties are accessed
- **THEN** `name` equals "my-project"
- **AND** `path` equals "/data/my-project"

#### Scenario: StoreClient with description

- **GIVEN** a store definition with description "My project memories"
- **WHEN** a `StoreClient` is created for this store
- **THEN** `description` equals "My project memories"

#### Scenario: StoreClient without description

- **GIVEN** a store definition without description
- **WHEN** a `StoreClient` is created for this store
- **THEN** `description` is undefined

#### Scenario: Access root category

- **GIVEN** a `StoreClient` instance
- **WHEN** `rootCategory()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/"

## MODIFIED Requirements

### Requirement: Cortex Class

The system SHALL provide a `Cortex` class as the root client for the memory system. The class SHALL include:

1. `static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>` - Load from filesystem
2. `static init(options: CortexOptions): Cortex` - Create programmatically (sync, no filesystem)
3. `initialize(): Promise<Result<void, InitializeError>>` - Create folder structure (idempotent)
4. `getStore(name: string): Result<StoreClient, StoreNotFoundError>` - Factory for store clients
5. `readonly rootDirectory: string` - Config directory path
6. `readonly settings: CortexSettings` - Current settings
7. `getRegistry(): StoreRegistry` - Store definitions

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

#### Scenario: Get store returns StoreClient

- **GIVEN** a Cortex instance with store "my-project" in registry
- **WHEN** `getStore("my-project")` is called
- **THEN** it returns `Result<StoreClient, StoreNotFoundError>`
- **AND** the client wraps the store's adapter

#### Scenario: Get store for unknown store

- **GIVEN** a Cortex instance without store "unknown" in registry
- **WHEN** `getStore("unknown")` is called
- **THEN** it returns error with code `STORE_NOT_FOUND`
