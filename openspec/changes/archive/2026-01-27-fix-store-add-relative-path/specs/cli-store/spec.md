## ADDED Requirements

### Requirement: Store path normalization

The `cortex store add` command SHALL resolve relative paths to absolute paths before saving to the store registry.

#### Scenario: Relative path with dot prefix

- **WHEN** a user runs `cortex store add mystore ./relative/path`
- **THEN** the path is resolved to an absolute path relative to the current working directory
- **AND** the absolute path is stored in the registry

#### Scenario: Relative path with parent directory

- **WHEN** a user runs `cortex store add mystore ../sibling/path`
- **THEN** the path is resolved to an absolute path relative to the current working directory
- **AND** the absolute path is stored in the registry

#### Scenario: Implicit relative path

- **WHEN** a user runs `cortex store add mystore path/without/leading/slash`
- **THEN** the path is resolved to an absolute path relative to the current working directory
- **AND** the absolute path is stored in the registry

#### Scenario: Tilde expansion for home directory

- **WHEN** a user runs `cortex store add mystore ~/my-memories`
- **THEN** the tilde is expanded to the user's home directory
- **AND** the fully resolved absolute path is stored in the registry

#### Scenario: Absolute path remains unchanged

- **WHEN** a user runs `cortex store add mystore /absolute/path`
- **THEN** the absolute path is stored as-is in the registry

#### Scenario: Windows absolute path remains unchanged

- **WHEN** a user runs `cortex store add mystore C:\absolute\path` on Windows
- **THEN** the absolute path is stored as-is in the registry
