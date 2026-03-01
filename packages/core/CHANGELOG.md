# @yeseh/cortex-core

## 0.6.8

### Patch Changes

- 39a58e9: New version for publishing

## 0.6.7

### Patch Changes

- 7ca2ea7: Use bun to bundle the application

## 0.6.4

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

- b93b0a3: Seed default project categories when initialising a store without explicit categories

    `cortex store init` now pre-populates new stores with `defaultProjectCategories` (admin, tasks, standup, decisions, standards/coding) when no categories are provided. Previously the categories array was empty in both the config file and on disk.

    Two bugs are fixed:
    - Category directories and descriptions were not created because the seeding happened after `config.saveStore`, so `config.yaml` always wrote `categories: {}`.
    - `initializeStore` only called `categories.ensure` (mkdir) but never `categories.setDescription`, so category descriptions were never written to the index files.

    The fix resolves both by resolving `initialCategories` before saving the config, and by recursively calling `ensure` + `setDescription` for every category node (including subcategories).

- 4e128cc: Ensure initialize creates root category

## 0.6.2

## 0.6.1

## 0.6.0

## 0.5.1
