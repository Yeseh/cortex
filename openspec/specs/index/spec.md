# index Specification

## Purpose

Defines the category index structure and storage location for organizing memories within a store.
## Requirements
### Requirement: Index file structure

The system SHALL store category indexes in YAML with memory entries and subcategory references. Index serialization uses the standard `yaml` library, producing valid YAML that is semantically equivalent but may differ in whitespace or formatting from hand-crafted YAML. Memory entries SHALL include an optional `updated_at` timestamp for recency-based sorting.

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

#### Scenario: Memory entry with updatedAt

- **WHEN** a memory entry in the index includes an `updated_at` field
- **THEN** the system parses it as an ISO 8601 date and exposes it as `updatedAt` on `IndexMemoryEntry`

#### Scenario: Memory entry without updatedAt

- **WHEN** a memory entry in the index omits the `updated_at` field
- **THEN** the `updatedAt` field on `IndexMemoryEntry` is `undefined`
- **AND** the entry remains valid

### Requirement: Manual reindex

The system SHALL provide a reindex operation that rebuilds indexes from filesystem contents. During reindex, the system SHALL populate the `updatedAt` field on index entries by reading `updated_at` from each memory file's frontmatter.

#### Scenario: Rebuilding indexes

- **WHEN** a user invokes the reindex command
- **THEN** all category indexes are regenerated

#### Scenario: Reindex populates updatedAt

- **WHEN** a reindex operation processes a memory file with `updated_at` in its frontmatter
- **THEN** the resulting index entry includes `updatedAt` set to the memory's `updated_at` value

#### Scenario: Reindex handles missing updatedAt

- **WHEN** a reindex operation processes a memory file without `updated_at` in its frontmatter
- **THEN** the resulting index entry has `updatedAt` set to `undefined`

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

### Requirement: Index module documentation standards

The index module SHALL follow project documentation standards with comprehensive JSDoc annotations for all public types and functions.

#### Scenario: Type documentation completeness

- **WHEN** a developer views the index types in their IDE
- **THEN** they see complete documentation including purpose, field descriptions, and examples

#### Scenario: Error code documentation

- **WHEN** an `IndexParseError` or `IndexSerializeError` is returned
- **THEN** the error code is documented with conditions under which it occurs

### Requirement: Index file name constant

The index file name `index.yaml` SHALL be exported as a named constant `INDEX_FILE_NAME` from the index module.

#### Scenario: Referencing index file name

- **WHEN** code needs the index file name
- **THEN** it imports `INDEX_FILE_NAME` from the index module rather than using a hardcoded string

### Requirement: Error type forward compatibility

Index error types SHALL include an optional `cause` field for capturing underlying errors.

#### Scenario: Wrapping underlying errors

- **WHEN** an index operation fails due to an underlying error (e.g., YAML parse failure)
- **THEN** the error can include the original error as the `cause` field

#### Scenario: Backward compatible error handling

- **WHEN** existing code handles index errors
- **THEN** the optional `cause` field does not break existing error handling logic

### Requirement: Index updatedAt on memory write

When a memory is created or updated, the system SHALL include the memory's `updatedAt` timestamp in the corresponding category index entry.

#### Scenario: Create memory updates index with updatedAt

- **WHEN** a new memory is created
- **THEN** the category index entry for that memory includes `updatedAt` set to the creation timestamp

#### Scenario: Update memory refreshes index updatedAt

- **WHEN** an existing memory is updated
- **THEN** the category index entry for that memory includes `updatedAt` set to the update timestamp

