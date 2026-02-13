## MODIFIED Requirements

### Requirement: Index storage interface

The system SHALL provide an `IndexStorage` interface with the following methods:

- `reindex()` — rebuild the entire SQLite index from filesystem state
- `updateEntry(slugPath, entry)` — upsert a single memory entry in the index
- `removeEntry(slugPath)` — remove a single memory entry from the index
- `query(filter)` — query memories by filter criteria, returning `IndexMemoryEntry[]`

The interface SHALL NOT include `read()` or `write()` for full index data — these are internal to the storage adapter.

#### Scenario: Interface methods

- **WHEN** the `IndexStorage` interface is defined
- **THEN** it includes `reindex()`, `updateEntry(slugPath, entry)`, `removeEntry(slugPath)`, and `query(filter)`

#### Scenario: Query returns filtered results

- **WHEN** `adapter.indexes.query({ tags: ['architecture'], limit: 10 })` is called
- **THEN** it returns up to 10 `IndexMemoryEntry` objects matching the tag filter

### Requirement: In-folder category indexes

Category index data SHALL be stored in the SQLite database at `STORE_ROOT/cortex.db`, not in per-category `index.yaml` files.

#### Scenario: Index database location

- **WHEN** a store is initialized or reindexed
- **THEN** the index database exists at `STORE_ROOT/cortex.db`

#### Scenario: No per-category index files

- **WHEN** the system writes index data
- **THEN** no `index.yaml` files are created or updated
