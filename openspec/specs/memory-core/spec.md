# memory-core Specification

## Purpose

TBD - created by archiving change add-memory-core-model. Update Purpose after archive.

## Requirements

### Requirement: Memory hierarchy and identity

The system SHALL represent memories using one or more category levels and identify each memory by its slug path. Category depth is unlimited.

#### Scenario: Valid single-level hierarchy

- **WHEN** a memory path is provided as `category/memory`
- **THEN** the system treats the path as a valid memory identity

#### Scenario: Valid multi-level hierarchy

- **WHEN** a memory path is provided as `category/subcategory/nested/memory`
- **THEN** the system treats the path as a valid memory identity

#### Scenario: Recommended organization convention

- **WHEN** organizing memories for multi-project use
- **THEN** the recommended convention is `global/` for cross-project memories and `projects/<name>/` for project-specific memories
- **NOTE** This convention is not enforced by the system

### Requirement: Memory file format

The system SHALL store each memory as a markdown file with YAML frontmatter metadata and free-form content.

#### Scenario: Persisting a memory file

- **WHEN** a memory is persisted
- **THEN** the file includes frontmatter fields for timestamps, tags, source, and optional expiry
