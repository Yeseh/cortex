# Tasks: Merge config files

## 1. Config Schema Updates

- [ ] 1.1 Define `CortexSettings` interface in `packages/core/src/config.ts`
- [ ] 1.2 Define `StoreDefinition` interface (path, description)
- [ ] 1.3 Update config schema to include `settings:` and `stores:` sections
- [ ] 1.4 Add validation for absolute store paths
- [ ] 1.5 Add default values for `CortexSettings`

## 2. Config Parsing

- [ ] 2.1 Write `parseConfig()` function for new merged format
- [ ] 2.2 Write `serializeConfig()` function for new merged format
- [ ] 2.3 Add `CORTEX_CONFIG_PATH` environment variable support
- [ ] 2.4 Add tilde expansion for env var paths

## 3. FilesystemRegistry Updates

- [ ] 3.1 Update `FilesystemRegistry` to read merged `config.yaml` format
- [ ] 3.2 Remove `stores.yaml` reading logic
- [ ] 3.3 Update initialization to write merged format

## 4. Tests

- [ ] 4.1 Write tests for config parsing with merged format
- [ ] 4.2 Write tests for config serialization
- [ ] 4.3 Write tests for absolute path validation
- [ ] 4.4 Write tests for env var override
- [ ] 4.5 Update existing tests using separate stores.yaml

## 5. Validation

- [ ] 5.1 Run `bun test` - all tests pass
- [ ] 5.2 Run `bun run lint` - no errors
- [ ] 5.3 Run `bun run typecheck` - no errors
