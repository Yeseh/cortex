# storage-filesystem Specification

## Purpose

Defines the filesystem storage adapter that persists memories and indexes to disk using the canonical store layout.
## Requirements
### Requirement: ScopedStorageAdapter Interface

The system SHALL provide a `ScopedStorageAdapter` interface representing a storage adapter scoped to a specific store. It SHALL have:

- `memories: MemoryStorage`
- `indexes: IndexStorage`
- `categories: CategoryStorage`

It SHALL NOT include store or registry operations (the adapter is already scoped).

#### Scenario: Scoped adapter provides memory operations

- **GIVEN** a `ScopedStorageAdapter` instance
- **WHEN** accessing `adapter.memories`
- **THEN** it provides `MemoryStorage` interface for the scoped store

### Requirement: Storage adapter interface

The system SHALL provide a storage adapter interface that composes four focused storage interfaces: `MemoryStorage`, `IndexStorage`, `CategoryStorage`, and `StoreStorage`.

#### Scenario: Accessing memory operations

- **WHEN** a consumer needs to read or write memory files
- **THEN** it accesses `adapter.memories.read()` or `adapter.memories.write()`

#### Scenario: Accessing index operations

- **WHEN** a consumer needs to read or write index files
- **THEN** it accesses `adapter.indexes.read()` or `adapter.indexes.write()`

#### Scenario: Accessing category operations

- **WHEN** a consumer needs to manage categories
- **THEN** it accesses `adapter.categories.exists()`, `adapter.categories.readIndex()`, etc.

#### Scenario: Accessing store operations

- **WHEN** a consumer needs to manage store registries
- **THEN** it accesses `adapter.stores.load()`, `adapter.stores.save()`, or `adapter.stores.remove()`

### Requirement: Filesystem adapter

The system SHALL provide a filesystem adapter that implements `StorageAdapter` by composing four focused storage implementations. The memory serialization SHALL support a `citations` field in YAML frontmatter, serialized as a YAML array of strings under the `citations` key (snake_case on disk, camelCase in domain).

#### Scenario: Writing a memory to disk

- **WHEN** a memory is persisted via `adapter.memories.write()`
- **THEN** the filesystem adapter writes the memory file
- **AND** the business layer is responsible for updating indexes via `adapter.indexes`

#### Scenario: Module organization

- **WHEN** the filesystem adapter is examined
- **THEN** it composes four separate storage implementations: `FilesystemMemoryStorage`, `FilesystemIndexStorage`, `FilesystemCategoryStorage`, and `FilesystemStoreStorage`
- **AND** each implementation receives the shared `FilesystemContext` in its constructor

#### Scenario: Serializing citations in frontmatter

- **WHEN** a memory with citations is serialized to a file
- **THEN** the frontmatter includes a `citations` key with the array of citation strings

#### Scenario: Parsing citations from frontmatter

- **WHEN** a memory file with a `citations` field in frontmatter is parsed
- **THEN** the citations are deserialized into a `string[]` on the domain model

#### Scenario: Parsing memory without citations field

- **WHEN** a memory file without a `citations` field in frontmatter is parsed
- **THEN** the `citations` field defaults to an empty array `[]`

### Requirement: Memory file location

Memory files SHALL be stored directly under `STORE_ROOT` as `**/*.md` files, not in a separate `memories/` subdirectory.

#### Scenario: Writing a memory creates file at correct path

- **WHEN** a memory with slug path `global/project-info` is persisted
- **THEN** the filesystem adapter writes the file at `STORE_ROOT/global/project-info.md`

#### Scenario: Memory in nested category

- **WHEN** a memory with slug path `projects/cortex/architecture` is persisted
- **THEN** the filesystem adapter writes the file at `STORE_ROOT/projects/cortex/architecture.md`

### Requirement: In-folder category indexes

Each category directory SHALL contain an `index.yaml` file within that directory (in-folder indexes), not in a separate `indexes/` tree.

#### Scenario: Category index location

- **WHEN** a category at path `global` is indexed
- **THEN** the index file is stored at `STORE_ROOT/global/index.yaml`

#### Scenario: Nested category index location

- **WHEN** a category at path `projects/cortex` is indexed
- **THEN** the index file is stored at `STORE_ROOT/projects/cortex/index.yaml`

### Requirement: Index file extension

Index files SHALL use the `.yaml` extension, not `.yml`.

#### Scenario: Index file naming

- **WHEN** the filesystem adapter writes a category index
- **THEN** the file is named `index.yaml`

### Requirement: Memory storage interface

The system SHALL provide a `MemoryStorage` interface for memory file operations with simplified method names.

#### Scenario: Interface methods

- **WHEN** the `MemoryStorage` interface is defined
- **THEN** it includes `read(slugPath)`, `write(slugPath, contents)`, `remove(slugPath)`, and `move(source, destination)`

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

### Requirement: Category storage interface location

The `CategoryStorage` interface SHALL be defined in the category module (`core/category/types.ts`) and re-exported by the storage module.

#### Scenario: Interface reuse

- **WHEN** the filesystem storage adapter needs a category storage interface
- **THEN** it imports `CategoryStorage` from `core/category/types.ts`
- **AND** the interface does not use a "Port" suffix

### Requirement: Store storage interface

The system SHALL provide a `StoreStorage` interface for store registry operations with simplified method names.

#### Scenario: Interface methods

- **WHEN** the `StoreStorage` interface is defined
- **THEN** it includes `load(path, options?)`, `save(path, registry)`, and `remove(path)`

#### Scenario: Load with allowMissing option

- **WHEN** `adapter.stores.load(path, { allowMissing: true })` is called and the registry file does not exist
- **THEN** an empty registry is returned instead of an error

### Requirement: Business layer index coordination

Index updates during memory writes SHALL be the responsibility of the business layer, not the storage adapter.

#### Scenario: Memory write without automatic index update

- **WHEN** `adapter.memories.write(slugPath, contents)` is called
- **THEN** only the memory file is written
- **AND** the caller is responsible for calling `adapter.indexes` or `adapter.categories` to update indexes

### Requirement: AdapterFactory type

The system SHALL provide an `AdapterFactory` type alias:

```typescript
type AdapterFactory = (storePath: string) => ScopedStorageAdapter;
```

#### Scenario: Default adapter factory

- **WHEN** `Cortex.init()` is called without `adapterFactory`
- **THEN** the default factory creates `FilesystemStorageAdapter` instances

#### Scenario: Custom adapter factory for testing

- **WHEN** `Cortex.init()` is called with custom `adapterFactory`
- **AND** `getStore(name)` is called
- **THEN** the custom factory is invoked with the store's path
- **AND** the returned adapter is used

### Requirement: Cortex reads merged config

The `Cortex.fromConfig()` method SHALL read the merged `config.yaml` format with `settings:` and `stores:` sections.

#### Scenario: Reading merged config

- **GIVEN** a `config.yaml` with `settings:` and `stores:` sections
- **WHEN** `Cortex.fromConfig(configDir)` is called
- **THEN** both settings and store definitions are loaded
- **AND** accessible via `cortex.settings` and `cortex.registry`

#### Scenario: Config directory resolution

- **GIVEN** a config directory path like `~/.config/cortex`
- **WHEN** `Cortex.fromConfig(path)` is called
- **THEN** it reads `config.yaml` from that directory
- **AND** sets `rootDirectory` to the resolved absolute path

