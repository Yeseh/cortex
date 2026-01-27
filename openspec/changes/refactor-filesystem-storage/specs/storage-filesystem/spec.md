## MODIFIED Requirements

### Requirement: Filesystem adapter

The system SHALL provide a filesystem adapter organized as a module with focused sub-modules for memories, indexes, and categories.

#### Scenario: Writing a memory to disk

- **WHEN** a memory is persisted
- **THEN** the filesystem adapter writes the memory file and updates indexes

#### Scenario: Module organization

- **WHEN** the filesystem adapter is examined
- **THEN** it is organized into separate files for memory operations, index operations, and category operations
- **AND** a facade class composes these modules into the public `FilesystemStorageAdapter`

### Requirement: Frontmatter format location

Memory file frontmatter parsing and serialization SHALL be located in the filesystem storage module, not in the core memory domain.

#### Scenario: Frontmatter as storage concern

- **WHEN** the filesystem adapter reads a memory file
- **THEN** it uses frontmatter parsing from `storage/filesystem/formats/frontmatter.ts`

#### Scenario: Domain independence

- **WHEN** the core memory module is used
- **THEN** it does not contain any file format parsing or serialization code
