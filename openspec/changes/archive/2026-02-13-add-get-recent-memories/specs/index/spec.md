## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Index updatedAt on memory write

When a memory is created or updated, the system SHALL include the memory's `updatedAt` timestamp in the corresponding category index entry.

#### Scenario: Create memory updates index with updatedAt

- **WHEN** a new memory is created
- **THEN** the category index entry for that memory includes `updatedAt` set to the creation timestamp

#### Scenario: Update memory refreshes index updatedAt

- **WHEN** an existing memory is updated
- **THEN** the category index entry for that memory includes `updatedAt` set to the update timestamp
