## MODIFIED Requirements

### Requirement: Index file structure

The system SHALL store index data in a single SQLite database (`cortex.db`) per store. The database is a derived cache — rebuildable from filesystem `.md` files via `reindex`. The schema includes a `memories` table (path, category, tags as JSON, token_estimate, source, created_at/updated_at/expires_at as epoch ms, summary) and a `categories` table (path, parent_path, description).

#### Scenario: Reading index data

- **WHEN** index data is queried via `IndexStorage.query(filter)`
- **THEN** the system returns matching `IndexMemoryEntry` objects from the SQLite database

#### Scenario: Database is derived

- **WHEN** the SQLite database is deleted or corrupted
- **THEN** the system can rebuild it from filesystem `.md` files via `reindex`
- **AND** no data is lost because the filesystem is the source of truth

### Requirement: Manual reindex

The system SHALL provide a reindex operation that rebuilds the SQLite database from filesystem contents.

#### Scenario: Rebuilding indexes

- **WHEN** a user invokes the reindex command
- **THEN** the SQLite database is dropped and rebuilt from all `.md` files in the store

#### Scenario: Auto-rebuild on missing database

- **WHEN** an operation accesses a store with no `cortex.db` file
- **THEN** the system automatically triggers a reindex with a log/warning message
- **AND** the operation proceeds after the rebuild completes

### Requirement: SQLite WAL mode

The SQLite database SHALL use WAL (Write-Ahead Logging) journal mode for concurrent access.

#### Scenario: Concurrent readers and writers

- **WHEN** multiple agents or processes access the same store simultaneously
- **THEN** readers are not blocked by writers
- **AND** data integrity is maintained

## ADDED Requirements

### Requirement: Surgical index updates

The system SHALL support updating or removing individual memory entries in the index without a full reindex.

#### Scenario: Updating a single entry

- **WHEN** a memory is created or updated
- **THEN** `IndexStorage.updateEntry(slugPath, entry)` upserts the corresponding row in the SQLite database

#### Scenario: Removing a single entry

- **WHEN** a memory is deleted or moved
- **THEN** `IndexStorage.removeEntry(slugPath)` removes the corresponding row from the SQLite database

### Requirement: Query interface

The system SHALL provide a `query(filter)` method on `IndexStorage` that supports filtering, sorting, and pagination of memory index entries.

#### Scenario: Query by tags

- **WHEN** `query({ tags: ['architecture', 'decision'] })` is called
- **THEN** memories matching ANY of the specified tags are returned

#### Scenario: Query by category scope

- **WHEN** `query({ category: 'decisions' })` is called
- **THEN** memories in `decisions` and all its subcategories are returned

#### Scenario: Query by date range

- **WHEN** `query({ updatedAfter: date1, updatedBefore: date2 })` is called
- **THEN** only memories updated within the range are returned

#### Scenario: Sorted and paginated results

- **WHEN** `query({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })` is called
- **THEN** results are sorted by update time descending with pagination applied

## REMOVED Requirements

### Requirement: Category index file name

**Reason**: Index data is stored in SQLite, not per-category YAML files.
**Migration**: Remove `index.yaml` files manually. System ignores them.

### Requirement: In-folder index location

**Reason**: Replaced by single `cortex.db` file at store root.
**Migration**: Old `index.yaml` files become inert.

### Requirement: Root index at store root

**Reason**: Replaced by `cortex.db` at store root.
**Migration**: Root `index.yaml` is no longer read or written.

### Requirement: Subcategory description field

**Reason**: Category descriptions are now stored in the `categories` table in SQLite.
**Migration**: Descriptions are rebuilt from filesystem state via `reindex`.

### Requirement: Description serialization format

**Reason**: YAML serialization of descriptions is replaced by SQLite storage.
**Migration**: No action needed — `reindex` populates the database.

### Requirement: Index file name constant

**Reason**: No more `index.yaml` files. Constant is no longer needed.
**Migration**: Remove `INDEX_FILE_NAME` from exports.

### Requirement: Index module documentation standards

**Reason**: Superseded by new SQLite-based index types. Documentation standards still apply but requirement text references obsolete YAML types.
**Migration**: New types will follow the same documentation standards.

### Requirement: Error type forward compatibility

**Reason**: Index errors will be redesigned around SQLite operations. The `cause` field pattern continues but the specific error types change.
**Migration**: New error types for SQLite operations.
