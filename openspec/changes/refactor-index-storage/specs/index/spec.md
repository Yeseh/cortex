## MODIFIED Requirements

### Requirement: Index file structure

The system SHALL store category indexes as structured `CategoryIndex` data. The serialization format (currently YAML) is an internal concern of the storage adapter. Core domain operations work exclusively with structured `CategoryIndex` objects and never handle raw serialized content.

#### Scenario: Reading a category index

- **WHEN** a category index is loaded via `IndexStorage.read()`
- **THEN** the system returns a structured `CategoryIndex` object with memory entries and subcategory metadata

#### Scenario: Round-trip equivalence

- **WHEN** a `CategoryIndex` is written via `IndexStorage.write()` and then read back via `IndexStorage.read()`
- **THEN** the returned data is semantically equivalent to the original

## REMOVED Requirements

### Requirement: Index file name constant

**Reason**: The index file name is an internal detail of the storage adapter. Core code no longer needs to reference it.
**Migration**: Remove `INDEX_FILE_NAME` export from core. Storage adapter uses it internally.
