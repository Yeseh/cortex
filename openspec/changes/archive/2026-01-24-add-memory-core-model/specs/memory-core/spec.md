## ADDED Requirements
### Requirement: Memory hierarchy and identity
The system SHALL represent memories using a maximum of two category levels and identify each memory by its slug path.

#### Scenario: Valid two-level hierarchy
- **WHEN** a memory path is provided as `category/subcategory/memory`
- **THEN** the system treats the path as a valid memory identity

### Requirement: Memory file format
The system SHALL store each memory as a markdown file with YAML frontmatter metadata and free-form content.

#### Scenario: Persisting a memory file
- **WHEN** a memory is persisted
- **THEN** the file includes frontmatter fields for timestamps, tags, source, and optional expiry
