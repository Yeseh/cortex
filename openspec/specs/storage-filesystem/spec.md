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

The system SHALL provide a filesystem adapter that implements `StorageAdapter` by composing four focused storage implementations.

#### Scenario: Writing a memory to disk

- **WHEN** a memory is persisted via `adapter.memories.write()`
- **THEN** the filesystem adapter writes the memory file
- **AND** the business layer is responsible for updating indexes via `adapter.indexes`

#### Scenario: Module organization

- **WHEN** the filesystem adapter is examined
- **THEN** it composes four separate storage implementations: `FilesystemMemoryStorage`, `FilesystemIndexStorage`, `FilesystemCategoryStorage`, and `FilesystemStoreStorage`
- **AND** each implementation receives the shared `FilesystemContext` in its constructor

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

The system SHALL provide an `IndexStorage` interface for index file operations with simplified method names.

#### Scenario: Interface methods

- **WHEN** the `IndexStorage` interface is defined
- **THEN** it includes `read(name)`, `write(name, contents)`, and `reindex()`

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

### Requirement: FilesystemRegistry

The system SHALL provide a `FilesystemRegistry` class implementing the `Registry` interface for filesystem-based storage.

#### Scenario: Constructor accepts registry path

- **GIVEN** a filesystem path to store registry
- **WHEN** `new FilesystemRegistry(registryPath)` is called
- **THEN** the instance is configured to use that path

#### Scenario: Initialize creates registry file

- **GIVEN** a `FilesystemRegistry` instance
- **WHEN** `initialize()` is called
- **THEN** the registry file is created at the configured path
- **AND** parent directories are created if needed

#### Scenario: Load reads and caches registry

- **GIVEN** a registry file exists with store definitions
- **WHEN** `load()` is called
- **THEN** the registry is parsed and cached internally
- **AND** the parsed `StoreRegistry` is returned

#### Scenario: Load with missing file

- **GIVEN** no registry file exists
- **WHEN** `load()` is called
- **THEN** it returns error with code `REGISTRY_MISSING`

#### Scenario: Save persists registry

- **GIVEN** a `FilesystemRegistry` instance
- **WHEN** `save(registry)` is called
- **THEN** the registry is serialized and written to the configured path

#### Scenario: GetStore creates FilesystemStorageAdapter

- **GIVEN** a loaded registry with store "default" at path "/home/user/.cortex"
- **WHEN** `getStore("default")` is called
- **THEN** it returns a `FilesystemStorageAdapter` configured for that path
