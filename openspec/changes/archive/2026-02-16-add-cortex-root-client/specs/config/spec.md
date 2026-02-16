## MODIFIED Requirements

### Requirement: Merged configuration file

The system SHALL load settings and store definitions from a single `config.yaml` file with `settings:` and `stores:` sections.

#### Scenario: Config with settings and stores

- **WHEN** the config file contains `settings:` and `stores:` sections
- **THEN** the system loads both settings and store definitions
- **AND** settings override defaults where specified

#### Scenario: Config with only stores section

- **WHEN** the config file contains only a `stores:` section
- **THEN** the system uses default settings
- **AND** store definitions are loaded from the `stores:` section

#### Scenario: Config with only settings section

- **WHEN** the config file contains only a `settings:` section
- **THEN** the system uses the specified settings
- **AND** the store registry is empty

### Requirement: Supported config fields

The system SHALL support output_format, auto_summary, and strict_local fields under the `settings:` section.

#### Scenario: Settings section validation

- **WHEN** a config file includes supported fields under `settings:`
- **THEN** the system loads the values without error

#### Scenario: Default settings values

- **WHEN** settings fields are omitted
- **THEN** the system uses defaults: `output_format: yaml`, `auto_summary: false`, `strict_local: false`

### Requirement: Global config file location

The global configuration file SHALL be located at `~/.config/cortex/config.yaml`.

#### Scenario: Global config path

- **WHEN** the system loads global configuration
- **THEN** it reads from `~/.config/cortex/config.yaml`

## REMOVED Requirements

### Requirement: Store registry location

**Reason**: Store definitions are now merged into `config.yaml` under the `stores:` section.

**Migration**: Move store definitions from `stores.yaml` into the `stores:` section of `config.yaml`.

### Requirement: Global config directory layout

**Reason**: Layout simplified - only `config.yaml` and `memory/` needed, no separate `stores.yaml`.

**Migration**: The new layout is:

- `~/.config/cortex/config.yaml` - merged settings and stores
- `~/.config/cortex/memory/` - default global store root

## ADDED Requirements

### Requirement: CortexSettings type

The system SHALL define a `CortexSettings` type with the following fields:

- `output_format`: `'yaml' | 'json' | 'toon'` (default: `'yaml'`)
- `auto_summary`: `boolean` (default: `false`)
- `strict_local`: `boolean` (default: `false`)

#### Scenario: Settings type validation

- **WHEN** a CortexSettings object is created
- **THEN** all fields have valid values or defaults

### Requirement: Absolute store paths

Store paths in the configuration file SHALL be absolute paths. Relative paths are not supported.

#### Scenario: Absolute path validation

- **WHEN** a store definition uses an absolute path like `/home/user/.config/cortex/memory`
- **THEN** the path is accepted

#### Scenario: Relative path rejection

- **WHEN** a store definition uses a relative path like `./memory`
- **THEN** the system returns a validation error with code `INVALID_STORE_PATH`

### Requirement: Environment variable override

The system SHALL support `CORTEX_CONFIG_PATH` environment variable to override the default config directory location.

#### Scenario: Environment variable set

- **WHEN** `CORTEX_CONFIG_PATH` is set to `/custom/path`
- **THEN** the system uses `/custom/path/config.yaml` instead of `~/.config/cortex/config.yaml`

#### Scenario: Environment variable not set

- **WHEN** `CORTEX_CONFIG_PATH` is not set
- **THEN** the system uses the default `~/.config/cortex` directory

#### Scenario: Environment variable with tilde expansion

- **WHEN** `CORTEX_CONFIG_PATH` is set to `~/custom-cortex`
- **THEN** the system expands `~` to the user's home directory
