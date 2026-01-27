## MODIFIED Requirements

### Requirement: Memory file format

The system SHALL store each memory as a markdown file with YAML frontmatter metadata and free-form content. The frontmatter format is an implementation detail of the filesystem storage adapter, not a core domain concern.

#### Scenario: Persisting a memory file

- **WHEN** a memory is persisted via the filesystem storage adapter
- **THEN** the file includes frontmatter fields for timestamps, tags, source, and optional expiry

#### Scenario: Format handling is storage-layer concern

- **WHEN** the memory domain model is used
- **THEN** it does not expose file format parsing or serialization functions
- **AND** format handling is delegated to the storage adapter
