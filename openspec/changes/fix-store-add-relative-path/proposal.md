# Change: Resolve relative paths in store add command

## Why

When a user runs `cortex store add mystore ./relative/path`, the path is stored literally in `stores.yaml`. Later, when accessing the store from a different working directory, the relative path resolves incorrectly, causing store resolution failures.

## What Changes

- The `cortex store add` command SHALL resolve relative paths to absolute paths before saving to the registry
- Paths starting with `./`, `../`, or lacking a leading `/` (on Unix) or drive letter (on Windows) will be resolved relative to the current working directory
- Tilde expansion (`~`) for home directory SHALL be supported

## Impact

- Affected specs: `cli-store`
- Affected code: `src/cli/commands/store.ts` (specifically `runStoreAdd` and `validateStorePathInput`)
