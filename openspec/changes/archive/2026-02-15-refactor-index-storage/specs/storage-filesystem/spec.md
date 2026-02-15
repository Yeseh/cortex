## MODIFIED Requirements

### Requirement: Index storage interface

The system SHALL provide an `IndexStorage` interface that returns structured `CategoryIndex` data. The interface SHALL include `read(categoryPath)` returning `CategoryIndex | null`, `write(categoryPath, index: CategoryIndex)`, and `reindex()`. Parsing and serialization of the index format (e.g., YAML) is an internal concern of the storage adapter, not exposed through the interface.

#### Scenario: Interface methods

- **WHEN** the `IndexStorage` interface is defined
- **THEN** it includes `read(categoryPath)` returning `CategoryIndex | null`, `write(categoryPath, index)` accepting `CategoryIndex`, and `reindex()`

#### Scenario: Read returns structured data

- **WHEN** `adapter.indexes.read(categoryPath)` is called
- **THEN** it returns a structured `CategoryIndex` object or `null` if no index exists
- **AND** the caller never receives raw serialized strings

#### Scenario: Write accepts structured data

- **WHEN** `adapter.indexes.write(categoryPath, index)` is called with a `CategoryIndex` object
- **THEN** the storage adapter serializes it to its internal format (e.g., YAML)
- **AND** the caller never constructs serialized strings
