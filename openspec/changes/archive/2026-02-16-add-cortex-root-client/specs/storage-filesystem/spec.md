## REMOVED Requirements

### Requirement: FilesystemRegistry

**Reason**: `FilesystemRegistry` is replaced by `Cortex.fromConfig()` which encapsulates filesystem-based config loading.

**Migration**: Replace `new FilesystemRegistry(path)` with `await Cortex.fromConfig(path)`.

## ADDED Requirements

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
