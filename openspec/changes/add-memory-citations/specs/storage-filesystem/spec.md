## MODIFIED Requirements

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
