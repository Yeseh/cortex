## MODIFIED Requirements

### Requirement: Store management commands

The CLI SHALL provide commands to list, add, remove, and initialize stores under the `store` command group.

#### Scenario: Listing stores

- **WHEN** a user runs `cortex store list`
- **THEN** the CLI returns all registered stores

#### Scenario: Adding a store

- **WHEN** a user runs `cortex store add mystore /path/to/store`
- **THEN** the store is registered with the given name and path

#### Scenario: Removing a store

- **WHEN** a user runs `cortex store remove mystore`
- **THEN** the store is unregistered (files are not deleted)

### Requirement: Store initialization

The `cortex store init` command SHALL create a store root directory with an `index.yaml` file at the root.

The command SHALL accept `-n/--name` to override auto-detected store name.

The command SHALL auto-detect the git repository name as the store name, and register the store in the global registry.

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

- **WHEN** a user runs `cortex store init` in a git repository without `-n`
- **THEN** the store is named after the git repository directory name

#### Scenario: Name flag overrides auto-detection

- **WHEN** a user runs `cortex store init -n custom-name` in a git repository
- **THEN** the store is named `custom-name` instead of the git repository name

#### Scenario: Non-git directory without name flag

- **WHEN** a user runs `cortex store init` in a non-git directory without `-n`
- **THEN** the command returns an error requiring `-n/--name` to be specified

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

## ADDED Requirements

### Requirement: Store command group

The CLI SHALL provide a `store` command group that organizes all store management and maintenance operations.

#### Scenario: Store group help

- **WHEN** a user runs `cortex store --help`
- **THEN** the CLI displays available store subcommands including prune and reindex

### Requirement: Store selection for maintenance commands

The `store` command group SHALL accept a `-s/--store` option to select a named store for maintenance operations.

#### Scenario: Pruning a specific store

- **WHEN** a user runs `cortex store -s work prune`
- **THEN** expired memories are pruned from the `work` store

#### Scenario: Reindexing a specific store

- **WHEN** a user runs `cortex store -s work reindex`
- **THEN** indexes are rebuilt for the `work` store

### Requirement: Store prune command

The `store prune` command SHALL delete all expired memories from the target store.

#### Scenario: Pruning expired memories

- **WHEN** a user runs `cortex store prune`
- **THEN** all memories past their expiration date are deleted

#### Scenario: Prune with no expired memories

- **WHEN** a user runs `cortex store prune` and no memories are expired
- **THEN** the command completes successfully with a message indicating no memories were pruned

### Requirement: Store reindex command

The `store reindex` command SHALL rebuild all index files by scanning the filesystem.

#### Scenario: Rebuilding indexes

- **WHEN** a user runs `cortex store reindex`
- **THEN** all `index.yaml` files are regenerated from the current filesystem state

#### Scenario: Reindex repairs corrupted index

- **WHEN** an index file is corrupted or missing
- **AND** a user runs `cortex store reindex`
- **THEN** the index is recreated correctly
