## RENAMED Requirements

- FROM: `### Requirement: Registry Interface`
- TO: `### Requirement: Cortex Class`

## MODIFIED Requirements

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

### Requirement: CortexContext for handlers

The system SHALL provide a `CortexContext` interface for dependency injection into handlers:

- `cortex: Cortex` - The root client instance

#### Scenario: Handler receives context

- **GIVEN** a CLI or MCP handler function
- **WHEN** the handler is invoked
- **THEN** it receives `CortexContext` as its first parameter
- **AND** can access `ctx.cortex.getStore(name)`

### Requirement: Registry type (renamed from StoreRegistry)

The `StoreRegistry` type SHALL be renamed to `Registry` to represent the collection of store definitions.

#### Scenario: Registry type definition

- **WHEN** the `Registry` type is used
- **THEN** it is `Record<string, StoreDefinition>`
- **AND** `StoreDefinition` has `path: string` and optional `description?: string`

## REMOVED Requirements

### Requirement: Initialize Store Domain Operation

**Reason**: Store initialization logic moves into `Cortex.initialize()` and dedicated store operations.

**Migration**: Use `Cortex.init()` followed by `cortex.initialize()` for first-time setup.
