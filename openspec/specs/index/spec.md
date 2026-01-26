# index Specification

## Purpose

Defines the category index structure and storage location for organizing memories within a store.

## Requirements

### Requirement: Index file structure

The system SHALL store category indexes in YAML with memory entries and subcategory references.

#### Scenario: Reading a category index

- **WHEN** a category index is loaded
- **THEN** the system returns memory and subcategory metadata

### Requirement: Manual reindex

The system SHALL provide a reindex operation that rebuilds indexes from filesystem contents.

#### Scenario: Rebuilding indexes

- **WHEN** a user invokes the reindex command
- **THEN** all category indexes are regenerated

### Requirement: Category index file name

Category index files SHALL be named `index.yaml`.

#### Scenario: Index file naming convention

- **WHEN** the system creates or updates a category index
- **THEN** the file is named `index.yaml`

### Requirement: In-folder index location

Category index files SHALL be stored within the category directory itself (in-folder), not in a separate `indexes/` tree.

#### Scenario: Root index location

- **WHEN** the system accesses the root category index
- **THEN** the index file is located at `STORE_ROOT/index.yaml`

#### Scenario: Category index location

- **WHEN** the system accesses the index for category `global`
- **THEN** the index file is located at `STORE_ROOT/global/index.yaml`

#### Scenario: Nested category index location

- **WHEN** the system accesses the index for nested category `parent/child`
- **THEN** the index file is located at `STORE_ROOT/parent/child/index.yaml`

### Requirement: Root index at store root

The root category index SHALL live at `STORE_ROOT/index.yaml`.

#### Scenario: Root index presence

- **WHEN** a store is initialized or reindexed
- **THEN** an `index.yaml` file exists at the store root
