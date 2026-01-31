# cli-store Specification

## Purpose

Defines the CLI commands for managing memory stores, including listing, adding, removing, and initializing stores.

## Requirements

### Requirement: Store management commands

The CLI SHALL provide commands to list, add, remove, and initialize stores.

#### Scenario: Listing stores

- **WHEN** a user runs `cortex store list`
- **THEN** the CLI returns all registered stores

### Requirement: Store Init Command

The `store init` command SHALL use the `initializeStore` domain operation to create new stores. The command SHALL:

1. Resolve store name (explicit or from git repo)
2. Resolve target path (explicit or default to `.cortex`)
3. Call `initializeStore(registry, name, path)` domain operation
4. Create project entry in default store (best effort)

#### Scenario: Initialize store via domain operation

- **GIVEN** a valid store name and path
- **WHEN** `cortex store init` is executed
- **THEN** it calls `initializeStore` domain operation
- **AND** the store is created and registered

#### Scenario: Initialize store with git auto-detection

- **GIVEN** the current directory is a git repository "my-project"
- **WHEN** `cortex store init` is executed without `--name`
- **THEN** the store name is derived from git repo name
- **AND** `initializeStore` is called with the derived name

#### Scenario: Initializing a store creates canonical layout

- **WHEN** a user runs `cortex store init` in a directory
- **THEN** the store root contains an `index.yaml` file at the root level

#### Scenario: Store init does not create memories subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `memories/` subdirectory is created

#### Scenario: Store init does not create indexes subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `indexes/` subdirectory is created

#### Scenario: Name flag overrides auto-detection

- **WHEN** a user runs `cortex store init --name custom-name` in a git repository
- **THEN** the store is named `custom-name` instead of the git repository name

#### Scenario: Non-git directory without name flag

- **WHEN** a user runs `cortex store init` in a non-git directory without `--name`
- **THEN** the command returns an error requiring `--name` to be specified

#### Scenario: Store name collision

- **WHEN** a user runs `cortex store init` and the resolved name already exists in the registry
- **THEN** the command returns an error indicating the name is already in use

#### Scenario: Auto-register in global registry

- **WHEN** a user successfully runs `cortex store init`
- **THEN** the store is registered in `~/.config/cortex/stores.yaml` with its path

### Requirement: Store init with template categories

When `cortex store init` creates template categories, each category directory SHALL contain its own `index.yaml` file.

#### Scenario: Template category with in-folder index

- **WHEN** a user runs `cortex store init` and template categories are created
- **THEN** each category directory (e.g., `global/`, `projects/`) contains an `index.yaml` file

### Requirement: Project entry creation

When a project store is initialized, the CLI SHALL create a project entry memory in the default store for discoverability.

#### Scenario: Project entry created on init

- **WHEN** a user successfully runs `cortex store init`
- **THEN** a memory is created at `projects/{store-name}` in the default store

#### Scenario: Project entry contains metadata

- **WHEN** the project entry memory is created
- **THEN** it contains the project name and associated store name

#### Scenario: Default store auto-created if missing

- **WHEN** the default store does not exist during project entry creation
- **THEN** the default store is created before adding the project entry

### Requirement: Global Init Command

The `cortex init` command SHALL use the `initializeStore` domain operation for store creation while keeping CLI-specific concerns (config.yaml) in the CLI layer.

#### Scenario: Global init uses domain operation

- **GIVEN** no global config exists
- **WHEN** `cortex init` is executed
- **THEN** it calls `initializeStore` with name "default" and categories `["global", "projects"]`
- **AND** creates `config.yaml` in CLI layer
- **AND** creates `stores.yaml` via registry

#### Scenario: Global init with --force

- **GIVEN** global config already exists
- **WHEN** `cortex init --force` is executed
- **THEN** it reinitializes the store via `initializeStore`
- **AND** overwrites existing configuration
