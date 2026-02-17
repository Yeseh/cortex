---
{created_at: 2026-02-17T19:15:59.941Z,updated_at: 2026-02-17T19:44:03.199Z,tags: [decision,config,breaking-change,architecture,bun-yaml],source: mcp}
---
# Decision: Merged Config File Format

## Date
2026-02-17

## Status
Implemented (PR #37 merged)

## Context
The system previously used two separate config files: `config.yaml` for settings and `stores.yaml` for store definitions. This created cognitive overhead and required managing two closely related config systems.

## Decision
Merge both files into a single `config.yaml` with two sections:
- `settings:` - Output format, auto summary threshold, strict local flags
- `stores:` - Store name → path + description mappings

Use camelCase for all config keys to match TypeScript conventions and `CortexSettings` interface.

## Implementation
- Added `ConfigSettings` interface and `MergedConfig` type in `packages/core/src/config.ts`
- Added `parseMergedConfig()` and `serializeMergedConfig()` functions using `Bun.YAML.parse()` and `Bun.YAML.stringify()`
- Removed ~300 lines of manual line-by-line YAML parsing/serialization
- Added `getConfigDir()` and `getConfigPath()` with `CORTEX_CONFIG_PATH` env var support
- Updated `FilesystemRegistry` to read merged format
- Added `getSettings()` method to access loaded settings

## Breaking Changes
1. **Store paths must be absolute** - Relative paths rejected with `INVALID_STORE_PATH` error
2. **Separate `stores.yaml` no longer supported** - Migrate to unified `config.yaml`
3. **`FilesystemRegistry` constructor** - Now expects `config.yaml` path
4. **Config keys are camelCase** - `outputFormat`, `autoSummaryThreshold`, `strictLocal` (not snake_case)
5. **`autoSummaryThreshold` is a number** - Changed from `autoSummary: boolean` for consistency with `CortexSettings`

## Example Config
```yaml
settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  default:
    path: /home/user/.config/cortex/memory
    description: Default memory store
```

## Pull Request
https://github.com/Yeseh/cortex/pull/37