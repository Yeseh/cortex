## MODIFIED Requirements

### Requirement: Store initialization

The `cortex store init` command SHALL create a store root directory with:

- An `index.yaml` file at the root
- Category directories with their own `index.yaml` files

The command SHALL auto-detect the git repository name as the store name, accept a `--name` flag to override, and register the store in the global registry.

#### Scenario: Initializing a store creates canonical layout

- **WHEN** a user runs `cortex store init` in a directory
- **THEN** the store root contains an `index.yaml` file at the root level

#### Scenario: Store init does not create memories subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `memories/` subdirectory is created

#### Scenario: Store init does not create indexes subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `indexes/` subdirectory is created

#### Scenario: Auto-detect git repository name

- **WHEN** a user runs `cortex store init` in a git repository without `--name`
- **THEN** the store is named after the git repository directory name

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

## ADDED Requirements

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
