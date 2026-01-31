## ADDED Requirements

### Requirement: Storage factory interface

The system SHALL provide a `StorageFactory` interface that abstracts the creation of storage adapters, enabling dependency injection and alternative storage backends.

#### Scenario: Factory interface definition

- **WHEN** the `StorageFactory` interface is defined
- **THEN** it includes a `createAdapter(storeRoot: string): StorageAdapter` method
- **AND** the interface is exported from the core storage module

#### Scenario: Creating adapter via factory

- **WHEN** a consumer needs a storage adapter for a store
- **THEN** it calls `factory.createAdapter(storeRoot)` instead of directly instantiating an adapter class
- **AND** receives a fully configured `StorageAdapter` instance

### Requirement: Filesystem storage factory

The system SHALL provide a `FilesystemStorageFactory` implementation that creates `FilesystemStorageAdapter` instances.

#### Scenario: Default factory behavior

- **WHEN** `FilesystemStorageFactory.createAdapter(storeRoot)` is called
- **THEN** it returns a new `FilesystemStorageAdapter` configured with the provided root directory

#### Scenario: Factory export

- **WHEN** the storage-fs package is imported
- **THEN** it exports both `FilesystemStorageFactory` class and a `defaultStorageFactory` singleton instance
