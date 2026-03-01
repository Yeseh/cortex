# @yeseh/cortex-cli

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
