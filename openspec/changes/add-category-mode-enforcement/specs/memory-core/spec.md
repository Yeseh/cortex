## MODIFIED Requirements

### Requirement: Memory hierarchy and identity

The system SHALL represent memories using one or more category levels and identify each memory by its slug path. Category depth is unlimited. Categories MUST exist before memories can be created in them.

#### Scenario: Valid single-level hierarchy

- **WHEN** a memory path is provided as `category/memory`
- **AND** the category exists on disk
- **THEN** the system treats the path as a valid memory identity

#### Scenario: Valid multi-level hierarchy

- **WHEN** a memory path is provided as `category/subcategory/nested/memory`
- **AND** all parent categories exist on disk
- **THEN** the system treats the path as a valid memory identity

#### Scenario: Memory creation with missing category

- **WHEN** `createMemory` is called with path `nonexistent/memory`
- **AND** the category `nonexistent` does not exist on disk
- **THEN** the operation returns an error with code `CATEGORY_NOT_FOUND`
- **AND** the error message instructs to create the category first

#### Scenario: Memory creation in nested missing category

- **WHEN** `createMemory` is called with path `existing/missing/memory`
- **AND** `existing` exists but `existing/missing` does not
- **THEN** the operation returns an error with code `CATEGORY_NOT_FOUND`
- **AND** the error message identifies `existing/missing` as the missing category

#### Scenario: Recommended organization convention

- **WHEN** organizing memories for multi-project use
- **THEN** the recommended convention is `global/` for cross-project memories and `projects/<name>/` for project-specific memories
- **NOTE** This convention is not enforced by the system
