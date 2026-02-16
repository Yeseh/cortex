# Change: Merge config files

## Why

The system currently uses two separate config files: `config.yaml` for settings and `stores.yaml` for store definitions. This creates cognitive overhead and requires consumers to manage two config systems that are closely related.

## What Changes

- **Merge `stores.yaml` into `config.yaml`** - single file with `settings:` and `stores:` sections
- **Add `CortexSettings` type** - typed settings interface with defaults
- **Add absolute path validation** - store paths must be absolute, no relative paths
- **Add `CORTEX_CONFIG_PATH` env var** - override default config directory
- **BREAKING**: Remove separate `stores.yaml` file support

## Impact

- Affected specs: `config`
- Affected code:
    - `packages/core/src/config.ts` - merged config schema and parsing
    - `packages/storage-fs/src/filesystem-registry.ts` - read merged format
    - Tests using separate stores.yaml
