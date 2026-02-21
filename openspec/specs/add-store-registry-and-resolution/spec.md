# add-store-registry-and-resolution Specification

## Purpose

Defines the store registry format, resolution behavior, and abstraction interfaces for managing multiple memory stores.
## Requirements
### Requirement: Registry Interface

The system SHALL provide a `Registry` interface that abstracts store registry operations independent of storage backend. The interface SHALL include:

1. `initialize()` - First-time registry setup
2. `load()` - Load registry data (caches internally)
3. `save(registry)` - Persist registry data
4. `getStore(name)` - Synchronous factory returning `ScopedStorageAdapter`

#### Scenario: Registry initialization

- **GIVEN** no registry exists
- **WHEN** `initialize()` is called
- **THEN** the registry storage is created
- **AND** subsequent `load()` calls succeed

#### Scenario: Registry caches loaded data

- **GIVEN** a registry with stores configured
- **WHEN** `load()` is called
- **THEN** the registry data is cached internally
- **AND** `getStore(name)` can be called synchronously

#### Scenario: Get store returns scoped adapter

- **GIVEN** a loaded registry with store "my-project"
- **WHEN** `getStore("my-project")` is called
- **THEN** it returns `Result<ScopedStorageAdapter, StoreNotFoundError>`
- **AND** the adapter is scoped to the store's storage location

#### Scenario: Get store for unknown store

- **GIVEN** a loaded registry without store "unknown"
- **WHEN** `getStore("unknown")` is called
- **THEN** it returns error with code `STORE_NOT_FOUND`

### Requirement: Store Registry Parsing

The store registry parsing module SHALL be pure (no I/O operations). It SHALL provide:

1. `parseStoreRegistry(raw: string)` - Parse YAML to registry object
2. `serializeStoreRegistry(registry)` - Serialize registry to YAML
3. `isValidStoreName(name)` - Validate store name format
4. `resolveStorePath(registry, name)` - Lookup store path from registry

#### Scenario: Parse valid registry YAML

- **GIVEN** valid YAML with stores section
- **WHEN** `parseStoreRegistry(yaml)` is called
- **THEN** it returns parsed `StoreRegistry` object

#### Scenario: Serialize registry to YAML

- **GIVEN** a `StoreRegistry` object
- **WHEN** `serializeStoreRegistry(registry)` is called
- **THEN** it returns valid YAML string

### Requirement: Store registry format

The system SHALL store named store definitions in a YAML registry file that maps store names to path values and optional descriptions.

#### Scenario: Registry format with top-level mapping

- **WHEN** the registry file contains store names as top-level keys
- **THEN** each store name maps to its configured path value

#### Scenario: Registry format with stores section

- **WHEN** the registry file contains a top-level `stores` mapping
- **THEN** the system reads store names from the `stores` mapping

#### Scenario: Path value requirements

- **WHEN** a store entry is parsed
- **THEN** the store path MUST be a non-empty string value

#### Scenario: Missing path value

- **WHEN** a store entry omits its path value or provides a non-string value
- **THEN** the system returns a registry format error

#### Scenario: Duplicate store names

- **WHEN** a store name is defined more than once in the registry
- **THEN** the system returns a duplicate name error

#### Scenario: Inline comments

- **WHEN** the registry file includes YAML comments on the same line as a store entry
- **THEN** the system ignores the comments and reads the store name and path value

#### Scenario: Optional description field

- **WHEN** a store entry includes a `description` field
- **THEN** the system stores the description as metadata for the store

#### Scenario: Description field omitted

- **WHEN** a store entry omits the `description` field
- **THEN** the system treats the description as undefined (no error)

### Requirement: Store resolution behavior

The system SHALL resolve stores by checking a local .cortex directory first and falling back to the global registry only when strict_local is false.

#### Scenario: Local store precedence

- **WHEN** a local registry defines the requested store name
- **THEN** the system resolves the store using the local registry entry

#### Scenario: Strict local resolution

- **WHEN** strict_local is true and no local store exists
- **THEN** the system returns a resolution error

#### Scenario: Global fallback when strict_local is false

- **WHEN** strict_local is false and the local registry does not define the store
- **THEN** the system attempts to resolve the store from the global registry

#### Scenario: Global registry missing

- **WHEN** strict_local is false, the local registry does not define the store, and the global registry is missing
- **THEN** the system returns a global registry missing error

#### Scenario: Global store missing

- **WHEN** strict_local is false, the local registry does not define the store, and the global registry lacks the store name
- **THEN** the system returns a resolution error

### Requirement: List stores MCP tool

The MCP server SHALL provide a `cortex_list_stores` tool that returns all registered stores with their metadata.

#### Scenario: Listing available stores

- **WHEN** an agent calls `cortex_list_stores`
- **THEN** the tool returns a list of stores with name, path, and description for each

#### Scenario: Store without description

- **WHEN** a store has no description configured
- **THEN** the store is included in the list with description omitted or null

#### Scenario: Empty registry

- **WHEN** no stores are registered
- **THEN** the tool returns an empty list

### Requirement: Cortex Class

The system SHALL provide a `Cortex` class as the root client for the memory system. The class SHALL include:

1. `static fromConfig(configDir: string): Promise<Result<Cortex, ConfigError>>` - Load from filesystem
2. `static init(options: CortexOptions): Cortex` - Create programmatically (sync, no filesystem)
3. `initialize(): Promise<Result<void, InitializeError>>` - Create folder structure (idempotent)
4. `getStore(name: string): Result<StoreClient, StoreNotFoundError>` - Factory for store clients
5. `readonly rootDirectory: string` - Config directory path
6. `readonly settings: CortexSettings` - Current settings
7. `getRegistry(): StoreRegistry` - Store definitions

#### Scenario: Create Cortex from config file

- **GIVEN** a valid config file at `~/.config/cortex/config.yaml`
- **WHEN** `Cortex.fromConfig('~/.config/cortex')` is called
- **THEN** it returns `Result.ok(cortex)` with settings and registry loaded

#### Scenario: Create Cortex from config - missing file

- **GIVEN** no config file exists at the specified path
- **WHEN** `Cortex.fromConfig(path)` is called
- **THEN** it returns error with code `CONFIG_NOT_FOUND`

#### Scenario: Create Cortex programmatically

- **GIVEN** valid `CortexOptions` with `rootDirectory`
- **WHEN** `Cortex.init(options)` is called
- **THEN** it returns a `Cortex` instance synchronously
- **AND** no filesystem operations occur

#### Scenario: Cortex init with defaults

- **GIVEN** only `rootDirectory` is provided in options
- **WHEN** `Cortex.init({ rootDirectory })` is called
- **THEN** default settings are used
- **AND** registry is empty
- **AND** default adapter factory (filesystem) is used

#### Scenario: Cortex init with custom adapter factory

- **GIVEN** options include `adapterFactory` function
- **WHEN** `Cortex.init(options)` is called
- **AND** `getStore(name)` is called
- **THEN** the custom factory is used to create adapters

#### Scenario: Initialize creates folder structure

- **GIVEN** a `Cortex` instance with `rootDirectory` that doesn't exist
- **WHEN** `initialize()` is called
- **THEN** the directory structure is created
- **AND** `config.yaml` is written with current settings and registry

#### Scenario: Initialize is idempotent

- **GIVEN** a `Cortex` instance where `rootDirectory` already exists with config
- **WHEN** `initialize()` is called
- **THEN** it succeeds without error
- **AND** existing config is preserved

#### Scenario: Get store returns StoreClient

- **GIVEN** a Cortex instance with store "my-project" in registry
- **WHEN** `getStore("my-project")` is called
- **THEN** it returns `Result<StoreClient, StoreNotFoundError>`
- **AND** the client wraps the store's adapter

#### Scenario: Get store for unknown store

- **GIVEN** a Cortex instance without store "unknown" in registry
- **WHEN** `getStore("unknown")` is called
- **THEN** it returns error with code `STORE_NOT_FOUND`

### Requirement: CortexOptions interface

The system SHALL provide a `CortexOptions` interface for programmatic Cortex creation:

- `rootDirectory: string` (required) - Path to config directory
- `settings?: Partial<CortexSettings>` (optional) - Override default settings
- `registry?: Registry` (optional) - Store definitions (default: empty)
- `adapterFactory?: AdapterFactory` (optional) - Custom adapter creation (default: filesystem)

#### Scenario: Options with all fields

- **WHEN** `CortexOptions` includes all fields
- **THEN** all values are used as specified

#### Scenario: Options with only rootDirectory

- **WHEN** `CortexOptions` includes only `rootDirectory`
- **THEN** default settings, empty registry, and filesystem adapter factory are used

### Requirement: Registry type (renamed from StoreRegistry)

The `StoreRegistry` type SHALL be renamed to `Registry` to represent the collection of store definitions.

#### Scenario: Registry type definition

- **WHEN** the `Registry` type is used
- **THEN** it is `Record<string, StoreDefinition>`
- **AND** `StoreDefinition` has `path: string` and optional `description?: string`

### Requirement: CortexContext for handlers

The system SHALL provide a `CortexContext` interface for dependency injection into handlers:

- `cortex: Cortex` - The root client instance

#### Scenario: Handler receives context

- **GIVEN** a CLI or MCP handler function
- **WHEN** the handler is invoked
- **THEN** it receives `CortexContext` as its first parameter
- **AND** can access `ctx.cortex.getStore(name)`

### Requirement: StoreClient class

The system SHALL provide a `StoreClient` class that wraps a store's storage adapter and provides fluent access to categories. The class SHALL include:

1. `readonly name: string` - Store name
2. `readonly path: string` - Filesystem path to store
3. `readonly description?: string` - Optional store description
4. `rootCategory(): CategoryClient` - Entry point to category tree

#### Scenario: StoreClient exposes metadata

- **GIVEN** a `StoreClient` for store "my-project" at path "/data/my-project"
- **WHEN** the client properties are accessed
- **THEN** `name` equals "my-project"
- **AND** `path` equals "/data/my-project"

#### Scenario: StoreClient with description

- **GIVEN** a store definition with description "My project memories"
- **WHEN** a `StoreClient` is created for this store
- **THEN** `description` equals "My project memories"

#### Scenario: StoreClient without description

- **GIVEN** a store definition without description
- **WHEN** a `StoreClient` is created for this store
- **THEN** `description` is undefined

#### Scenario: Access root category

- **GIVEN** a `StoreClient` instance
- **WHEN** `rootCategory()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/"

### Requirement: CategoryClient class

The system SHALL provide a `CategoryClient` class that enables fluent navigation and operations on categories. The class SHALL include:

**Properties:**

1. `readonly rawPath: string` - Canonical path with leading slash (e.g., `/standards/javascript`)

**Parsing:** 2. `parsePath(): Result<CategoryPath, PathError>` - Parse raw path to value object

**Navigation (synchronous, lazy validation):** 3. `getCategory(path: string): CategoryClient` - Get subcategory by relative path 4. `getMemory(slug: string): Result<MemoryClient, MemoryError>` - Get memory client for slug 5. `parent(): CategoryClient | null` - Parent category, null if root

**Lifecycle:** 6. `create(): Promise<Result<Category, CategoryError>>` - Create category on disk 7. `delete(): Promise<Result<void, CategoryError>>` - Delete category (always recursive) 8. `exists(): Promise<Result<boolean, CategoryError>>` - Check if category exists

**Metadata:** 9. `setDescription(description: string | null): Promise<Result<void, CategoryError>>` - Update description

**Listing:** 10. `listMemories(options?): Promise<Result<MemoryInfo[], CategoryError>>` - List memories 11. `listSubcategories(): Promise<Result<CategoryInfo[], CategoryError>>` - List child categories

**Store-wide operations (scoped to subtree):** 12. `reindex(): Promise<Result<ReindexResult, CategoryError>>` - Rebuild indexes 13. `prune(options?): Promise<Result<PruneResult, CategoryError>>` - Remove expired memories

#### Scenario: Root category path

- **GIVEN** a `StoreClient` instance
- **WHEN** `rootCategory()` is called
- **THEN** it returns `CategoryClient` with `rawPath` equal to "/"

#### Scenario: Canonical path format

- **GIVEN** a root category
- **WHEN** `getCategory('standards')` is called
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - leading slash

- **GIVEN** a root category
- **WHEN** `getCategory('/standards')` is called (with leading slash)
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - trailing slash

- **GIVEN** a root category
- **WHEN** `getCategory('standards/')` is called (with trailing slash)
- **THEN** the returned client has `rawPath` equal to "/standards"

#### Scenario: Path normalization - multiple slashes

- **GIVEN** a root category
- **WHEN** `getCategory('standards//javascript')` is called
- **THEN** the returned client has `rawPath` equal to "/standards/javascript"

#### Scenario: Nested navigation

- **GIVEN** a category client with `rawPath` "/standards"
- **WHEN** `getCategory('javascript')` is called
- **THEN** the returned client has `rawPath` equal to "/standards/javascript"

#### Scenario: Parent of nested category

- **GIVEN** a category client with `rawPath` "/standards/javascript"
- **WHEN** `parent()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/standards"

#### Scenario: Parent of depth-1 category

- **GIVEN** a category client with `rawPath` "/standards"
- **WHEN** `parent()` is called
- **THEN** it returns a `CategoryClient` with `rawPath` equal to "/"

#### Scenario: Parent of root category

- **GIVEN** a category client with `rawPath` "/"
- **WHEN** `parent()` is called
- **THEN** it returns null

#### Scenario: Lazy validation - valid path

- **GIVEN** a category client created with valid path "standards/javascript"
- **WHEN** `exists()` is called
- **THEN** the path is validated successfully
- **AND** the operation proceeds

#### Scenario: Lazy validation - invalid path

- **GIVEN** a category client created with invalid path "INVALID PATH!!!"
- **WHEN** `exists()` is called
- **THEN** it returns error with code `INVALID_PATH`

#### Scenario: Create category

- **GIVEN** a category client for path "/standards/typescript"
- **WHEN** `create()` is called
- **THEN** the category is created on disk
- **AND** it returns `Result<Category, CategoryError>`

#### Scenario: Delete category is recursive

- **GIVEN** a category with subcategories and memories
- **WHEN** `delete()` is called
- **THEN** the category and all contents are deleted

#### Scenario: List subcategories

- **GIVEN** a category with subcategories "api" and "utils"
- **WHEN** `listSubcategories()` is called
- **THEN** it returns `CategoryInfo[]` for both subcategories

#### Scenario: Reindex scoped to subtree

- **GIVEN** a category client for "/standards"
- **WHEN** `reindex()` is called
- **THEN** only indexes under "/standards" are rebuilt

#### Scenario: Prune scoped to subtree

- **GIVEN** a category client for "/archive"
- **WHEN** `prune()` is called
- **THEN** only expired memories under "/archive" are removed

### Requirement: MemoryClient class

The system SHALL provide a `MemoryClient` class that enables fluent operations on individual memories. The class SHALL include:

**Properties:**

1. `path: MemoryPath` - Full path including category (e.g., `standards/javascript/style`)
2. `slug: Slug` - Memory name value object (e.g., `style`)

**Factory:** 3. `create(path: string, slug: string, adapter: ScopedStorageAdapter): MemoryResult<MemoryClient>` - Create validated client

**Parsing:** 4. `parsePath(): Result<MemoryPath, MemoryError>` - Parse path to value object 5. `parseSlug(): Result<Slug, MemoryError>` - Parse raw slug to value object

**Lifecycle (lazy validation):** 6. `create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>` - Create memory 7. `get(options?: GetMemoryOptions): Promise<Result<Memory, MemoryError>>` - Retrieve memory 8. `update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>` - Update memory 9. `delete(): Promise<Result<void, MemoryError>>` - Remove memory 10. `exists(): Promise<Result<boolean, MemoryError>>` - Check if memory exists

**Movement:** 11. `move(destination: MemoryClient | MemoryPath): Promise<MemoryResult<MemoryClient>>` - Move memory

#### Scenario: MemoryClient path and slug

- **GIVEN** a category client for "/standards/javascript"
- **WHEN** `getMemory('style')` is called
- **THEN** it returns `Result.ok(MemoryClient)`
- **AND** the client `path` equals `standards/javascript/style`
- **AND** the client `slug` equals `style`

#### Scenario: Parse path

- **GIVEN** a `MemoryClient` with `path` `standards/javascript/style`
- **WHEN** `parsePath()` is called
- **THEN** it returns `Result.ok(MemoryPath)` with correct segments

#### Scenario: Parse slug

- **GIVEN** a `MemoryClient` with `slug` "style"
- **WHEN** `parseSlug()` is called
- **THEN** it returns `Result.ok(Slug)` with value "style"

#### Scenario: Factory rejects invalid path

- **GIVEN** an invalid memory path like "/invalid"
- **WHEN** `MemoryClient.create(path, slug, adapter)` is called
- **THEN** it returns error with code `INVALID_PATH`

#### Scenario: Parse slug invalid input

- **GIVEN** a `MemoryClient` created with invalid slug "INVALID SLUG!!!"
- **WHEN** `parseSlug()` is called
- **THEN** it returns error with code `INVALID_PATH`

#### Scenario: Create memory

- **GIVEN** a `MemoryClient` for "/standards/typescript/style"
- **WHEN** `create({ content: '# Style Guide' })` is called
- **THEN** the memory is created on disk
- **AND** it returns `Result<Memory, MemoryError>`

#### Scenario: Get memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `get()` is called
- **THEN** it returns `Result<Memory, MemoryError>` with content and metadata

#### Scenario: Get memory with expiration filtering

- **GIVEN** a `MemoryClient` for an expired memory
- **WHEN** `get()` is called without options
- **THEN** it returns error with code `MEMORY_EXPIRED`

#### Scenario: Get memory including expired

- **GIVEN** a `MemoryClient` for an expired memory
- **WHEN** `get({ includeExpired: true })` is called
- **THEN** it returns the memory content

#### Scenario: Update memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `update({ content: 'new content' })` is called
- **THEN** the memory is updated on disk
- **AND** it returns the updated `Memory`

#### Scenario: Delete memory

- **GIVEN** a `MemoryClient` for an existing memory
- **WHEN** `delete()` is called
- **THEN** the memory is removed from disk

#### Scenario: Check memory exists

- **GIVEN** a `MemoryClient` for path "/standards/style"
- **WHEN** `exists()` is called
- **THEN** it returns `Result<boolean, MemoryError>`

#### Scenario: Move memory to MemoryClient destination

- **GIVEN** a `MemoryClient` for "/standards/old-style"
- **AND** a destination `MemoryClient` for "/archive/old-style"
- **WHEN** `move(destinationClient)` is called
- **THEN** the memory is moved on disk
- **AND** it returns a new `MemoryClient` for "/archive/old-style"

#### Scenario: Move memory to MemoryPath destination

- **GIVEN** a `MemoryClient` for "/standards/old-style"
- **AND** a `MemoryPath` for "/archive/2024/old-style"
- **WHEN** `move(memoryPath)` is called
- **THEN** the memory is moved on disk
- **AND** it returns a new `MemoryClient` for "/archive/2024/old-style"

#### Scenario: Move preserves source client path

- **GIVEN** a `MemoryClient` source for "/standards/style"
- **WHEN** `move(destination)` is called
- **THEN** the source client's `path` remains `standards/style`
- **AND** a new client is returned for the destination

