## MODIFIED Requirements

### Requirement: Store Init Command

The `store init` command SHALL use the `initializeStore` domain operation to create new stores. The command SHALL support templates for predefined category structures.

#### Scenario: Initialize store via domain operation

- **GIVEN** a valid store name and path
- **WHEN** `cortex store init` is executed
- **THEN** it calls `initializeStore` domain operation
- **AND** the store is created and registered

#### Scenario: Initialize store with template

- **GIVEN** a valid store name and path
- **WHEN** `cortex store init --template agent-project` is executed
- **THEN** the store is created with the template's category mode and hierarchy
- **AND** categories are written to `config.yaml`
- **AND** category directories are created on disk

#### Scenario: Initialize store with git auto-detection

- **GIVEN** the current directory is a git repository "my-project"
- **WHEN** `cortex store init` is executed without `--name`
- **THEN** the store name is derived from git repo name
- **AND** `initializeStore` is called with the derived name

#### Scenario: Template creates category directories

- **WHEN** `cortex store init --template agent-project` is executed
- **THEN** `createCategory` is called for each category in the template
- **AND** each category directory contains an `index.yaml` file

#### Scenario: Default template behavior

- **WHEN** `cortex store init` is executed without `--template`
- **THEN** the store is created with `categoryMode: free` and no predefined categories

#### Scenario: Invalid template name

- **WHEN** `cortex store init --template nonexistent` is executed
- **THEN** the command returns an error listing available templates

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

### Requirement: Global Init Command

The `cortex init` command SHALL use the `initializeStore` domain operation for store creation and support templates for predefined category structures.

#### Scenario: Global init uses domain operation

- **GIVEN** no global config exists
- **WHEN** `cortex init` is executed
- **THEN** it calls `initializeStore` with name "default"
- **AND** creates `config.yaml` in CLI layer
- **AND** creates `stores.yaml` via registry

#### Scenario: Global init with template

- **WHEN** `cortex init --template personal` is executed
- **THEN** the default store is created with the personal template hierarchy
- **AND** categories like `human/profile` and `human/preferences` are created

#### Scenario: Global init default template

- **WHEN** `cortex init` is executed without `--template`
- **THEN** the store is created with `categoryMode: free` and categories `["global", "projects"]`

#### Scenario: Global init with --force

- **GIVEN** global config already exists
- **WHEN** `cortex init --force` is executed
- **THEN** it reinitializes the store via `initializeStore`
- **AND** overwrites existing configuration

## ADDED Requirements

### Requirement: Store templates

The CLI SHALL provide predefined templates for common store configurations. Each template defines a category mode and hierarchy.

#### Scenario: Agent-project template

- **WHEN** the `agent-project` template is applied
- **THEN** the store has `categoryMode: subcategories`
- **AND** root categories include `standards`, `decisions`, `todo`, `map`, `runbooks`
- **AND** each category has an appropriate description

#### Scenario: Minimal template

- **WHEN** the `minimal` template is applied
- **THEN** the store has `categoryMode: free`
- **AND** no categories are predefined

#### Scenario: Personal template

- **WHEN** the `personal` template is applied
- **THEN** the store has `categoryMode: subcategories`
- **AND** root categories include `human` with subcategories `profile` and `preferences`

#### Scenario: Listing available templates

- **WHEN** `cortex store init --help` is executed
- **THEN** the help text lists available templates with descriptions
