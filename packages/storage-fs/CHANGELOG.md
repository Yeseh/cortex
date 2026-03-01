# @yeseh/cortex-storage-fs

## 0.6.3

### Patch Changes

- 18dd91b: Fix local store auto-detection for category and memory commands

    Commands (`category create`, `memory add/show/update/list/move/remove`, `store prune/reindex`) previously fell back to the hardcoded `global` store when no `--store` flag was given, even when the user had initialised a local store with `cortex store init` in the current directory.

    A new `resolveDefaultStore` utility now implements the documented resolution order:
    1. Explicit `--store` flag
    2. Local store — a registered store whose path is `<cwd>/.cortex` or `<cwd>/.cortex/memory`
    3. `settings.defaultStore` from the config file
    4. Hard-coded fallback: `global`

    Error messages were also improved throughout:
    - `storage-fs`: filesystem category errors now include the full resolved path and a hint to run `cortex store init`
    - `cli`: unknown store errors now list available stores and suggest `--store` or `cortex store init`
    - `core`: `STORE_NOT_FOUND` fallback message now references `cortex store list`

- Updated dependencies [18dd91b]
- Updated dependencies [b93b0a3]
- Updated dependencies [4e128cc]
    - @yeseh/cortex-core@0.6.3

## 0.6.2

### Patch Changes

- @yeseh/cortex-core@0.6.2

## 0.6.1

### Patch Changes

- @yeseh/cortex-core@0.6.1

## 0.6.0

### Patch Changes

- @yeseh/cortex-core@0.6.0

## 0.5.1

### Patch Changes

- @yeseh/cortex-core@0.5.1
