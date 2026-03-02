# @yeseh/cortex-cli

## 0.6.9

### Patch Changes

- e5d6868: Build of shame
- 3c52349: Another build of shame
- Updated dependencies [e5d6868]
- Updated dependencies [3c52349]
    - @yeseh/cortex-core@0.6.9
    - @yeseh/cortex-storage-fs@0.6.9

## 0.6.8

### Patch Changes

- 39a58e9: New version for publishing
- Updated dependencies [39a58e9]
    - @yeseh/cortex-core@0.6.8
    - @yeseh/cortex-storage-fs@0.6.8

## 0.6.7

### Patch Changes

- 7ca2ea7: Use bun to bundle the application
- Updated dependencies [7ca2ea7]
    - @yeseh/cortex-storage-fs@0.6.7
    - @yeseh/cortex-core@0.6.7

## 0.6.4

### Patch Changes

- f816907: Restore human-readable CLI log output by default.

    CLI logs now emit readable stderr lines (`INFO: ...`, `WARN: ...`, `ERROR: ...`) instead of structured JSON by default, while keeping `DEBUG=cortex` gated debug logging and error context output.

- d7a40cf: Fix duplicate CLI error text for command failures.

    When a command throws an error handled by `runProgram`, stderr now prints a single clear message instead of repeating the same text in both the main message and `error="..."` metadata.
    - @yeseh/cortex-core@0.6.4
    - @yeseh/cortex-storage-fs@0.6.4

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

- 4e128cc: Ensure initialize creates root category
- Updated dependencies [18dd91b]
- Updated dependencies [b93b0a3]
- Updated dependencies [4e128cc]
    - @yeseh/cortex-core@0.6.3
    - @yeseh/cortex-storage-fs@0.6.3

## 0.6.2

### Patch Changes

- 0f0180b: Fix a bug where `cortex store init` would return a 'store not found' error for the new store
    - @yeseh/cortex-core@0.6.2
    - @yeseh/cortex-storage-fs@0.6.2

## 0.6.1

### Patch Changes

- a6f6bb4: Correctly use current package version for cortex --version
    - @yeseh/cortex-core@0.6.1
    - @yeseh/cortex-storage-fs@0.6.1

## 0.6.0

### Minor Changes

- 9180e5b: Add TTY-aware interactive prompts to `cortex init` and `cortex store init`. When running in a real terminal, users are asked to confirm or change the resolved path and store name before anything is written to disk. Non-TTY environments (CI, pipes, scripts) are completely unaffected.

### Patch Changes

- @yeseh/cortex-core@0.6.0
- @yeseh/cortex-storage-fs@0.6.0

## 0.5.1

### Patch Changes

- @yeseh/cortex-core@0.5.1
- @yeseh/cortex-storage-fs@0.5.1
