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
3. When stdin is a TTY, prompt for store name (skipped if `--name` given) and path (skipped if path argument given)
4. Call `initializeStore(registry, name, path)` domain operation
5. Create project entry in default store (best effort)

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

#### Scenario: Non-git directory without name flag in non-TTY

- **WHEN** a user runs `cortex store init` in a non-git directory without `--name` and stdin is not a TTY
- **THEN** the command returns an error requiring `--name` to be specified

#### Scenario: Non-git directory without name flag in TTY

- **WHEN** a user runs `cortex store init` in a non-git directory without `--name` and stdin is a TTY
- **THEN** the command prompts the user for a store name

#### Scenario: Store name collision

- **WHEN** a user runs `cortex store init` and the resolved name already exists in the registry
- **THEN** the command returns an error indicating the name is already in use

#### Scenario: Auto-register in global registry

- **WHEN** a user successfully runs `cortex store init`
- **THEN** the store is registered in `~/.config/cortex/stores.yaml` with its path

#### Scenario: Interactive prompts skipped in non-TTY

- **WHEN** `cortex store init` is executed in a non-TTY environment (CI, pipes)
- **THEN** no prompts are shown and the command uses resolved defaults

#### Scenario: Interactive prompts for name and path in TTY

- **WHEN** `cortex store init` is executed in a TTY without `--name` and without a path argument
- **THEN** the user is prompted to confirm or change the store name
- **AND** the user is prompted to confirm or change the store path

#### Scenario: Interactive name prompt skipped when explicit name given

- **WHEN** `cortex store init --name my-store` is executed in a TTY
- **THEN** the name prompt is skipped
- **AND** only the path prompt is shown

#### Scenario: Interactive path prompt skipped when explicit path given

- **WHEN** `cortex store init ./custom-path` is executed in a TTY without `--name`
- **THEN** the path prompt is skipped
- **AND** only the name prompt is shown

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

#### Scenario: Interactive prompts skipped in non-TTY

- **WHEN** `cortex init` is executed in a non-TTY environment (CI, pipes)
- **THEN** no prompts are shown and the command uses defaults

#### Scenario: Interactive prompts for path and name in TTY

- **WHEN** `cortex init` is executed in a TTY
- **THEN** the user is prompted to confirm or change the global store path
- **AND** the user is prompted to confirm or change the global store name

