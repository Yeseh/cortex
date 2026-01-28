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
