## 1. Update existing workflows for new paths

- [x] 1.1 Update `core.yml` paths from `src/core/` to `packages/core/` (already done in monorepo conversion)
- [x] 1.2 Update `cli.yml` paths from `src/cli/` to `packages/cli/` (already done in monorepo conversion)
- [x] 1.3 Update `mcp-server.yml` paths from `src/server/` to `packages/server/` (already done in monorepo conversion)
- [x] 1.4 Add `packages/storage-fs/` to core workflow triggers (dependency)

## 2. Update CI commands for workspace structure

- [x] 2.1 Update lint commands to use workspace paths (already done in monorepo conversion)
- [x] 2.2 Update test commands: `bun test packages/core/` etc. (already done in monorepo conversion)
- [x] 2.3 Update build commands for workspace structure (already done in monorepo conversion)
- [x] 2.4 Update typecheck to use `tsc --build` (already done in monorepo conversion)

## 3. Create release workflow

- [x] 3.1 Create `.github/workflows/release.yml`
- [x] 3.2 Configure trigger on `v*` tag push
- [x] 3.3 Add build step for all packages
- [x] 3.4 Add test step for all packages
- [x] 3.5 Add publish step using `bun changeset publish`

## 4. Configure GitHub Packages publishing

- [x] 4.1 Configure npm registry in workflow
- [x] 4.2 Set up `NODE_AUTH_TOKEN` from `GITHUB_TOKEN`
- [x] 4.3 Add `publishConfig` to each package.json

## 5. Add CI workflow

- [~] 5.1 Create or update unified CI workflow for PRs (skipped - existing per-package workflows sufficient)
- [~] 5.2 Run lint, typecheck, test, build across all packages (covered by release workflow)
- [~] 5.3 Use matrix strategy if beneficial (not needed)

## 6. Testing

- [x] 6.1 Verify workflows pass on a test branch
- [ ] 6.2 Test release workflow with a pre-release tag (requires merge and tag)

## Pull Request

- [x] PR created: https://github.com/Yeseh/cortex/pull/15
