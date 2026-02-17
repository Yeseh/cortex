---
{created_at: 2026-02-17T19:44:08.399Z,updated_at: 2026-02-17T19:44:08.399Z,tags: [completed,config,refactor,pr-37],source: mcp,expires_at: 2026-05-17T23:59:59.000Z}
---
# Completed: Merge Config Files (PR #37)

## Date
2026-02-17

## Summary
Merged `config.yaml` and `stores.yaml` into a unified config format with camelCase keys.

## Key Changes
- Unified two config files into single `config.yaml` with `settings:` and `stores:` sections
- Switched all config keys from snake_case to camelCase (`outputFormat`, `autoSummaryThreshold`, `strictLocal`)
- Changed `autoSummary: boolean` to `autoSummaryThreshold: number` for `CortexSettings` consistency
- Removed ~300 lines of manual YAML parsing, now using `Bun.YAML.parse()` and `Bun.YAML.stringify()`
- Net code reduction: ~417 lines across 12 files

## Commits
1. `feat(core): merge config.yaml and stores.yaml into unified config format`
2. `refactor(core): simplify config with Bun.YAML and camelCase keys`

## PR
https://github.com/Yeseh/cortex/pull/37