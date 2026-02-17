# Tasks: Merge config files

## 1. Config Schema Updates

- [x] 1.1 Define `CortexSettings` interface in `packages/core/src/config.ts`
- [x] 1.2 Define `StoreDefinition` interface (path, description)
- [x] 1.3 Update config schema to include `settings:` and `stores:` sections
- [x] 1.4 Add validation for absolute store paths
- [x] 1.5 Add default values for `CortexSettings`

## 2. Config Parsing

- [x] 2.1 Write `parseConfig()` function for new merged format
- [x] 2.2 Write `serializeConfig()` function for new merged format
- [x] 2.3 Add `CORTEX_CONFIG_PATH` environment variable support
- [x] 2.4 Add tilde expansion for env var paths

## 3. FilesystemRegistry Updates

- [x] 3.1 Update `FilesystemRegistry` to read merged `config.yaml` format
- [x] 3.2 Remove `stores.yaml` reading logic
- [x] 3.3 Update initialization to write merged format

## 4. Tests

- [x] 4.1 Write tests for config parsing with merged format
- [x] 4.2 Write tests for config serialization
- [x] 4.3 Write tests for absolute path validation
- [x] 4.4 Write tests for env var override
- [x] 4.5 Update existing tests using separate stores.yaml

## 5. Validation

- [x] 5.1 Run `bun test` - all tests pass (766/766)
- [x] 5.2 Run `bun run lint` - no errors (only pre-existing warnings)
- [x] 5.3 Run `bun run typecheck` - no errors
