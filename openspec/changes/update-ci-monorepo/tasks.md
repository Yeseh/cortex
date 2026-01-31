## 1. Update existing workflows for new paths

- [ ] 1.1 Update `core.yml` paths from `src/core/` to `packages/core/`
- [ ] 1.2 Update `cli.yml` paths from `src/cli/` to `packages/cli/`
- [ ] 1.3 Update `mcp-server.yml` paths from `src/server/` to `packages/server/`
- [ ] 1.4 Add `packages/storage-fs/` to core workflow triggers (dependency)

## 2. Update CI commands for workspace structure

- [ ] 2.1 Update lint commands to use workspace paths
- [ ] 2.2 Update test commands: `bun test packages/core/` etc.
- [ ] 2.3 Update build commands for workspace structure
- [ ] 2.4 Update typecheck to use `tsc --build`

## 3. Create release workflow

- [ ] 3.1 Create `.github/workflows/release.yml`
- [ ] 3.2 Configure trigger on `v*` tag push
- [ ] 3.3 Add build step for all packages
- [ ] 3.4 Add test step for all packages
- [ ] 3.5 Add publish step using `bun changeset publish`

## 4. Configure GitHub Packages publishing

- [ ] 4.1 Configure npm registry in workflow
- [ ] 4.2 Set up `NODE_AUTH_TOKEN` from `GITHUB_TOKEN`
- [ ] 4.3 Add `publishConfig` to each package.json

## 5. Add CI workflow

- [ ] 5.1 Create or update unified CI workflow for PRs
- [ ] 5.2 Run lint, typecheck, test, build across all packages
- [ ] 5.3 Use matrix strategy if beneficial

## 6. Testing

- [ ] 6.1 Verify workflows pass on a test branch
- [ ] 6.2 Test release workflow with a pre-release tag
