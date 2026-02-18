# config Specification

## Purpose

Defines the configuration file structure and locations for global and local Cortex settings.
## Requirements
### Requirement: Layered configuration

The system SHALL load global and local configuration files and apply local overrides.

#### Scenario: Local overrides global

- **WHEN** the same key exists in both configs
- **THEN** the local value is used

### Requirement: Supported config fields

The system SHALL support output_format, auto_summary_threshold, and strict_local fields.

#### Scenario: Config validation

- **WHEN** a config file includes supported fields
- **THEN** the system loads the values without error

### Requirement: Global config file location

The global configuration file SHALL be located at `~/.config/cortex/config.yaml`.

#### Scenario: Global config path

- **WHEN** the system loads global configuration
- **THEN** it reads from `~/.config/cortex/config.yaml`

### Requirement: Store registry location

The store registry file SHALL be located at `~/.config/cortex/stores.yaml`.

#### Scenario: Store registry path

- **WHEN** the system loads the store registry
- **THEN** it reads from `~/.config/cortex/stores.yaml`

### Requirement: Global config directory layout

The global config directory at `~/.config/cortex/` SHALL contain:

- `config.yaml` for global configuration
- `stores.yaml` for the store registry
- `memory/` as the default global store root

#### Scenario: Global config directory structure

- **WHEN** a user inspects the global config directory
- **THEN** the directory contains `config.yaml`, `stores.yaml`, and a `memory/` subdirectory

### Requirement: Category mode configuration

Each store definition SHALL support a `categoryMode` field that controls category creation/deletion permissions. Valid values are `free`, `subcategories`, and `strict`. The default is `free` if not specified.

#### Scenario: Store with explicit category mode

- **WHEN** a store config includes `categoryMode: strict`
- **THEN** the system loads the store with strict mode enforcement

#### Scenario: Store without category mode

- **WHEN** a store config omits `categoryMode`
- **THEN** the system defaults to `free` mode

#### Scenario: Invalid category mode

- **WHEN** a store config includes an invalid `categoryMode` value
- **THEN** config parsing returns a validation error

### Requirement: Category hierarchy definition

Each store definition SHALL support a `categories` field containing a nested hierarchy of category definitions. Each category definition MAY include a `description` (string, max 500 chars) and `subcategories` (nested definitions).

#### Scenario: Store with category hierarchy

- **WHEN** a store config includes a `categories` block with nested definitions
- **THEN** the system parses the full hierarchy including descriptions

#### Scenario: Category without description

- **WHEN** a category definition uses empty object `{}` or omits `description`
- **THEN** the category is parsed with no description but remains valid

#### Scenario: Deeply nested categories

- **WHEN** a store config defines categories at arbitrary nesting depth
- **THEN** all levels are parsed and accessible

#### Scenario: Category description too long

- **WHEN** a category description exceeds 500 characters
- **THEN** config parsing returns a validation error

### Requirement: Config-defined category path resolution

The system SHALL provide a function to determine if a category path is defined in config. All ancestors of explicitly defined categories are implicitly config-defined.

#### Scenario: Explicitly defined category

- **WHEN** config defines `standards/architecture`
- **THEN** `isConfigDefined("standards/architecture")` returns true

#### Scenario: Ancestor of defined category

- **WHEN** config defines `standards/architecture`
- **THEN** `isConfigDefined("standards")` returns true (implicit ancestor)

#### Scenario: Non-config category

- **WHEN** config does not define `legacy` or any descendant
- **THEN** `isConfigDefined("legacy")` returns false

