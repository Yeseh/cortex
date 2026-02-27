# @yeseh/cortex-storage-fs

## 0.3.0

### Minor Changes

- ## Fluent Client API

    Introduced a hierarchical, Azure SDK-style client API for interacting with stores, categories, and memories. All navigation is synchronous and chainable; validation errors surface on the first async operation.

    ```typescript
    const memory = await cortex
        .getStore('default')
        .rootCategory()
        .getCategory('standards/architecture')
        .getMemory('decisions')
        .get();
    ```

    New client types: `StoreClient`, `CategoryClient`, `MemoryClient`. Categories are the aggregate root — all memory access flows through a category.

    ## MCP Server Self-Bootstrapping

    The MCP server now starts cleanly on a fresh machine without requiring a prior `cortex init`. On first run it auto-creates the config directory and default store, then serves tools immediately.

    ## ConfigAdapter in CortexContext

    `CortexContext` now exposes a `ConfigAdapter` for store management operations (add, remove, initialize). CLI and MCP store commands use this instead of directly accessing the filesystem.

    ## Scoped Prune and Reindex

    `prune` and `reindex` operations are now scoped to a specific store or category subtree and available on both the CLI and MCP server.

    ```bash
    cortex store prune default
    cortex store reindex default
    ```

    ## Category Mode Enforcement

    Core now enforces a `categoryMode` per store (`free`, `subcategories`, `strict`) controlling whether agents can freely create categories or are restricted to a predefined hierarchy.

    ## Comprehensive Test Coverage

    Added full unit test suites for the CLI (`@yeseh/cortex-cli`) and MCP server (`@yeseh/cortex-server`) packages — over 1,100 tests passing across the monorepo.

    ## MIT License

    Added `LICENSE` file and `"license": "MIT"` to all package manifests.

### Patch Changes

- Updated dependencies
    - @yeseh/cortex-core@0.3.0

## 0.2.0

### Minor Changes

- 1b72f79: Initial monorepo setup with changesets for version management
    - Restructured project as Bun workspaces monorepo
    - Added synchronized versioning across all packages
    - Configured changesets for automated changelog generation

- Release 0.4.0
    - Bump all Cortex packages in the fixed-version group to 0.4.0.
    - Includes CLI, core, MCP server, and filesystem storage adapter updates.

### Patch Changes

- Updated dependencies [1b72f79]
- Updated dependencies
    - @yeseh/cortex-core@0.2.0
