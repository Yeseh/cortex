# Change: Add CLI Category Bootstrapping

## Why

With category hierarchies defined in config and mode enforcement in place, users need a way to initialize stores with predefined category structures. The CLI should write hierarchy definitions to config and create the corresponding directories on disk.

## What Changes

- `cortex init` supports `--template` flag for predefined category structures
- `cortex store init` supports `--template` flag for predefined category structures
- Templates define category mode and hierarchy
- Init commands write to `config.yaml` and create directories via domain operations

## Impact

- Affected specs: `cli-store`
- Affected code:
    - `packages/cli/src/commands/init.ts`
    - `packages/cli/src/commands/store/init.ts`
    - `packages/cli/src/templates/` (new)

## Dependencies

- Requires `add-category-hierarchy-config` (config schema)
- Requires `add-category-mode-enforcement` (createCategory respects mode)
