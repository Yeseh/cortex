# index Specification

## Purpose

Defines the category index structure and storage location for organizing memories within a store.
## Requirements
### Requirement: Index file structure

The system SHALL store category indexes in YAML with memory entries and subcategory references. Index serialization uses the standard `yaml` library, producing valid YAML that is semantically equivalent but may differ in whitespace or formatting from hand-crafted YAML.

#### Scenario: Reading a category index

- **WHEN** a category index is loaded
- **THEN** the system returns memory and subcategory metadata

#### Scenario: Index format uses standard YAML

- **WHEN** a category index is serialized
- **THEN** the output is valid YAML produced by the `yaml` library
- **AND** the output can be parsed by any standard YAML parser

#### Scenario: Round-trip equivalence

- **WHEN** a category index is serialized and then parsed
- **THEN** the parsed data is semantically equivalent to the original

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

### Requirement: Subcategory description field

Subcategory entries in category indexes SHALL support an optional `description` field.

#### Scenario: Subcategory with description

- **WHEN** a category index contains a subcategory with a description
- **THEN** the index includes the description in the subcategory entry

#### Scenario: Subcategory without description

- **WHEN** a category index contains a subcategory without a description
- **THEN** the subcategory entry is valid and the description field is omitted

### Requirement: Description serialization format

Category descriptions SHALL be serialized in YAML as a `description` field in subcategory entries.

#### Scenario: YAML serialization with description

- **WHEN** a subcategory entry is serialized to YAML
- **THEN** the format includes `description` field when present:
    ```yaml
    subcategories:
        - path: projects/cortex
          memory_count: 5
          description: Cortex memory system project knowledge
    ```

#### Scenario: YAML serialization without description

- **WHEN** a subcategory entry without a description is serialized
- **THEN** the `description` field is omitted from the YAML output

