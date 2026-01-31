# Change: Update CI/CD for Monorepo Structure

## Why

The current CI has separate workflows per module (`core.yml`, `cli.yml`, `mcp-server.yml`) with path-based triggers. With the monorepo restructure:

- Paths change from `src/core/` to `packages/core/`
- Need a release workflow for tagged releases to GitHub Packages
- Should consolidate CI for efficiency while maintaining path-based triggers

## What Changes

**Update path triggers:**

- Update all workflow path filters from `src/` to `packages/`
- Add `packages/storage-fs/` to appropriate triggers

**Create release workflow:**

- New `.github/workflows/release.yml` triggered on `v*` tags
- Build all packages
- Run all tests
- Publish to GitHub Packages via `bun changeset publish`

**Update CI jobs:**

- Update lint, test, typecheck paths for workspace structure
- Use `bun run --filter` commands where appropriate
- Ensure proper workspace linking in CI

**GitHub Packages authentication:**

- Configure `NODE_AUTH_TOKEN` for publishing
- Set up npm registry configuration

## Impact

- Affected specs: None (CI/tooling change)
- Affected code:
    - `.github/workflows/core.yml` - path updates
    - `.github/workflows/cli.yml` - path updates
    - `.github/workflows/mcp-server.yml` - path updates
    - `.github/workflows/release.yml` - new file
- **NOT breaking for users**: CI/CD infrastructure only
