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
