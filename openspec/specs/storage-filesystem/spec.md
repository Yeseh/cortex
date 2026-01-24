# storage-filesystem Specification

## Purpose
TBD - created by archiving change add-storage-filesystem-adapter. Update Purpose after archive.
## Requirements
### Requirement: Storage adapter interface
The system SHALL provide a storage adapter interface for memory persistence.

#### Scenario: Using a storage adapter
- **WHEN** the Cortex facade performs a storage operation
- **THEN** it invokes the configured adapter

### Requirement: Filesystem adapter
The system SHALL provide a filesystem adapter that reads and writes memory files and indexes.

#### Scenario: Writing a memory to disk
- **WHEN** a memory is persisted
- **THEN** the filesystem adapter writes the memory file and updates indexes

