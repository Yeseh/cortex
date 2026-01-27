## MODIFIED Requirements

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

### Requirement: Memory domain model

The system SHALL define storage-agnostic domain types for memories using TypeScript `type` definitions (not `interface`) for pure data structures.

#### Scenario: Memory type structure

- **WHEN** representing a memory in code
- **THEN** the `Memory` type contains `metadata: MemoryMetadata` and `content: string`

#### Scenario: MemoryMetadata fields

- **WHEN** a memory has metadata
- **THEN** the `MemoryMetadata` type includes required fields `createdAt`, `updatedAt`, `tags`, `source` and optional field `expiresAt`

#### Scenario: Error type structure

- **WHEN** a memory operation fails
- **THEN** the error includes a discriminated `code` field, human-readable `message`, and optional `path` and `cause` fields

## REMOVED Requirements

### Requirement: Memory file format

**Reason**: This requirement conflates domain model with storage format. The YAML frontmatter format is a serialization concern belonging to the filesystem storage adapter, not the core domain model.

**Migration**: The frontmatter format is now documented in the `storage-filesystem` spec as a format adapter. The domain types (`Memory`, `MemoryMetadata`) are storage-agnostic.

## ADDED Requirements

### Requirement: Memory serialization formats

The system SHALL provide format adapters for serializing and deserializing memories, separate from the domain model.

#### Scenario: Frontmatter format adapter

- **WHEN** using the filesystem storage backend
- **THEN** the system provides `parseFrontmatter` and `serializeFrontmatter` functions in the `formats/frontmatter` module

#### Scenario: Format adapter error handling

- **WHEN** parsing fails
- **THEN** the format adapter returns a Result with format-specific error codes (e.g., `MISSING_FRONTMATTER`, `INVALID_TIMESTAMP`) and actionable error messages

#### Scenario: Round-trip consistency

- **WHEN** a memory is serialized then parsed
- **THEN** the resulting memory is equivalent to the original (content and metadata preserved)
