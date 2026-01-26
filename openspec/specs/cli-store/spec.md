# cli-store Specification

## Purpose

Defines the CLI commands for managing memory stores, including listing, adding, removing, and initializing stores.

## Requirements

### Requirement: Store management commands

The CLI SHALL provide commands to list, add, remove, and initialize stores.

#### Scenario: Listing stores

- **WHEN** a user runs `cortex store list`
- **THEN** the CLI returns all registered stores

### Requirement: Store initialization

The `cortex store init` command SHALL create a store root directory with:

- An `index.yaml` file at the root
- Category directories with their own `index.yaml` files
  The command SHALL NOT create `memories/` or `indexes/` subdirectories.

#### Scenario: Initializing a store creates canonical layout

- **WHEN** a user runs `cortex store init` in a directory
- **THEN** the store root contains an `index.yaml` file at the root level

#### Scenario: Store init does not create memories subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `memories/` subdirectory is created

#### Scenario: Store init does not create indexes subdirectory

- **WHEN** a user runs `cortex store init`
- **THEN** no `indexes/` subdirectory is created

### Requirement: Store init with template categories

When `cortex store init` creates template categories, each category directory SHALL contain its own `index.yaml` file.

#### Scenario: Template category with in-folder index

- **WHEN** a user runs `cortex store init` and template categories are created
- **THEN** each category directory (e.g., `global/`, `projects/`) contains an `index.yaml` file
