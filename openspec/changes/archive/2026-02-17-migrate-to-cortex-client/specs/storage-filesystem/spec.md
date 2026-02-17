## MODIFIED Requirements

### Requirement: FilesystemRegistry

The system SHALL provide both `FilesystemRegistry` for mutable registry operations AND `Cortex.fromConfig()` for read-only store access.

**Usage guidance:**
- Use `Cortex.fromConfig()` for read operations (getting store adapters)
- Use `FilesystemRegistry` for write operations (adding/removing stores)

#### Scenario: Read-only store access via Cortex
- **GIVEN** a valid config.yaml exists
- **WHEN** `await Cortex.fromConfig(configDir)` is called
- **THEN** returns a `Cortex` instance with access to registered stores via `getStore()`

#### Scenario: Mutable registry operations via FilesystemRegistry
- **GIVEN** a need to add or remove stores from the registry
- **WHEN** using `new FilesystemRegistry(path)` with `load()` and `save()`
- **THEN** the registry file is updated with the new store configuration
