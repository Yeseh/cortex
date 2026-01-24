## ADDED Requirements
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
