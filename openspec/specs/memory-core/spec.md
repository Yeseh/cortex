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

The system SHALL store each memory as a markdown file with YAML frontmatter metadata and free-form content. The frontmatter format is an implementation detail of the filesystem storage adapter, not a core domain concern. Memory metadata SHALL include an optional `citations` field — an array of strings referencing source material (file paths, URLs).

#### Scenario: Persisting a memory file

- **WHEN** a memory is persisted via the filesystem storage adapter
- **THEN** the file includes frontmatter fields for timestamps, tags, source, optional expiry, and optional citations

#### Scenario: Format handling is storage-layer concern

- **WHEN** the memory domain model is used
- **THEN** it does not expose file format parsing or serialization functions
- **AND** format handling is delegated to the storage adapter

#### Scenario: Memory with citations

- **WHEN** a memory is created with citations
- **THEN** the metadata includes a `citations` array of strings

#### Scenario: Memory without citations

- **WHEN** a memory is created without citations
- **THEN** the `citations` field defaults to an empty array

#### Scenario: Citation format conventions

- **WHEN** citations are provided
- **THEN** file paths are relative to the project root with optional line number suffix (e.g., `src/memory/types.ts:17`)
- **AND** URLs are full URLs (e.g., `https://docs.example.com/api`)

