# storage-filesystem Specification

## Purpose

Defines the filesystem storage adapter that persists memories and indexes to disk using the canonical store layout.

## Requirements

### Requirement: Storage adapter interface

The system SHALL provide a storage adapter interface for memory persistence.

#### Scenario: Using a storage adapter

- **WHEN** the Cortex facade performs a storage operation
- **THEN** it invokes the configured adapter

### Requirement: Filesystem adapter

The system SHALL provide a filesystem adapter that reads and writes memory files and indexes.

#### Scenario: Writing a memory to disk

- **WHEN** a memory is persisted
- **THEN** the filesystem adapter writes the memory file and updates indexes

### Requirement: Memory file location

Memory files SHALL be stored directly under `STORE_ROOT` as `**/*.md` files, not in a separate `memories/` subdirectory.

#### Scenario: Writing a memory creates file at correct path

- **WHEN** a memory with slug path `global/project-info` is persisted
- **THEN** the filesystem adapter writes the file at `STORE_ROOT/global/project-info.md`

#### Scenario: Memory in nested category

- **WHEN** a memory with slug path `projects/cortex/architecture` is persisted
- **THEN** the filesystem adapter writes the file at `STORE_ROOT/projects/cortex/architecture.md`

### Requirement: In-folder category indexes

Each category directory SHALL contain an `index.yaml` file within that directory (in-folder indexes), not in a separate `indexes/` tree.

#### Scenario: Category index location

- **WHEN** a category at path `global` is indexed
- **THEN** the index file is stored at `STORE_ROOT/global/index.yaml`

#### Scenario: Nested category index location

- **WHEN** a category at path `projects/cortex` is indexed
- **THEN** the index file is stored at `STORE_ROOT/projects/cortex/index.yaml`

### Requirement: Index file extension

Index files SHALL use the `.yaml` extension, not `.yml`.

#### Scenario: Index file naming

- **WHEN** the filesystem adapter writes a category index
- **THEN** the file is named `index.yaml`
