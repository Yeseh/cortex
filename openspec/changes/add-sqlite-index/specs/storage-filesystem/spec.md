## MODIFIED Requirements

### Requirement: Index storage interface

The system SHALL provide an `IndexStorage` interface with the following methods:

- `reindex(scope: CategoryPath)` — rebuild the SQLite index from filesystem state, scoped to a category subtree (use `CategoryPath.root()` for store-wide)
- `updateEntry(slugPath, entry)` — upsert a single memory entry in the index
- `removeEntry(slugPath)` — remove a single memory entry from the index
- `query(filter)` — query memories by filter criteria, returning `IndexMemoryEntry[]`

The interface SHALL NOT include `load()`, `write()`, or `updateAfterMemoryWrite()` — these are replaced by the query and entry-level methods above.

#### Scenario: Interface methods

- **WHEN** the `IndexStorage` interface is defined
- **THEN** it includes `reindex(scope)`, `updateEntry(slugPath, entry)`, `removeEntry(slugPath)`, and `query(filter)`
- **AND** it does NOT include `load()`, `write()`, or `updateAfterMemoryWrite()`

#### Scenario: Scoped reindex

- **WHEN** `adapter.indexes.reindex(CategoryPath.root())` is called
- **THEN** the entire SQLite index is rebuilt from all `.md` files in the store

#### Scenario: Scoped subtree reindex

- **WHEN** `adapter.indexes.reindex(CategoryPath.fromString('standards').value)` is called
- **THEN** only entries under `standards/` are rebuilt in the SQLite index

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

## REMOVED Requirements

### Requirement: Index file extension

**Reason**: Index data is stored in SQLite (`cortex.db`), not YAML files. The `.yaml` extension requirement is obsolete.
**Migration**: Remove `indexExtension` from `FilesystemContext`. Old `index.yaml` files become inert.

### Requirement: updateAfterMemoryWrite interface method

**Reason**: Replaced by `updateEntry(slugPath, entry)` and `removeEntry(slugPath)` — surgical per-entry operations that the business layer calls directly after memory writes. The old method bundled ancestor-walk logic into the storage adapter, violating the business-layer coordination rule.
**Migration**: Business layer operations (`createMemory`, `updateMemory`, `moveMemory`, `removeMemory`) call `updateEntry`/`removeEntry` directly.
