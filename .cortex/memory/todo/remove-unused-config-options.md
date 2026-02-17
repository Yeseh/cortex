---
{created_at: 2026-02-17T20:13:05.405Z,updated_at: 2026-02-17T20:13:05.405Z,tags: [todo,config,cleanup,technical-debt],source: mcp}
---
# TODO: Remove Unused Config Options

## Priority
Medium

## Description
Remove `strictLocal` and `autoSummaryThreshold` from `ConfigSettings` and config parsing. These options are not used and not planned to be implemented.

## Current Location
- `packages/core/src/config.ts` - `ConfigSettings` interface and `getDefaultSettings()`
- `config.yaml` files may contain these keys

## Tasks
- [ ] Remove `strictLocal` from `ConfigSettings` interface
- [ ] Remove `autoSummaryThreshold` from `ConfigSettings` interface
- [ ] Update `getDefaultSettings()` to not include these
- [ ] Update `parseMergedConfig()` to ignore/warn on these keys
- [ ] Update any documentation referencing these options

## Context
These were placeholder options from early design that never got implemented. Cleaning them up simplifies the config schema before adding the new `categoryMode` and `categories` options.