## MODIFIED Requirements

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
