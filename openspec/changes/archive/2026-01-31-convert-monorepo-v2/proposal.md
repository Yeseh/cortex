# Change: Convert to Bun Workspaces Monorepo

## Why

Cortex is being prepared for open-source release. The current single-package structure makes it difficult to:

- Publish independent packages for consumers who only need specific functionality
- Allow users to install CLI or MCP server globally without pulling all dependencies
- Maintain clear boundaries between core logic, storage implementations, and application layers

The logical separation already exists in the codebase (`core/`, `cli/`, `server/`), but the project structure doesn't support independent versioning and publishing.

## What Changes

**Directory restructure:**

- Move `src/core/` to `packages/core/src/`
- Move `src/core/storage/filesystem/` to `packages/storage-fs/src/`
- Move `src/cli/` to `packages/cli/src/`
- Move `src/server/` to `packages/server/src/`

**Package configuration:**

- Create `packages/core/package.json` for `@yeseh/cortex-core`
- Create `packages/storage-fs/package.json` for `@yeseh/cortex-storage-fs`
- Create `packages/cli/package.json` for `@yeseh/cortex-cli`
- Create `packages/server/package.json` for `@yeseh/cortex-server`
- Update root `package.json` with `workspaces` field

**TypeScript configuration:**

- Create `tsconfig.base.json` at root with shared settings
- Create per-package `tsconfig.json` that extends base

**Import path updates:**

- Convert relative imports (`../../core/...`) to package imports (`@yeseh/cortex-core`)
- Update all internal references to use workspace package names

**Build configuration:**

- Configure each package with its own build output (`dist/`)
- Set up `exports` field in each `package.json`
- Configure TypeScript declaration emission

**Documentation:**

- Create README.md for each package
- Update root README.md with monorepo overview

## Impact

- Affected specs: None (organizational change only, no functional changes)
- Affected code:
    - All source files move to `packages/` structure
    - All import paths change to package references
    - Build scripts update to workspace commands
- **NOT breaking for users**: This is pre-release restructuring
