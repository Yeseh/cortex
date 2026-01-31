## 1. Create workspace structure

- [ ] 1.1 Create `packages/` directory with subdirectories: `core/`, `storage-fs/`, `cli/`, `server/`
- [ ] 1.2 Create root `tsconfig.base.json` with shared TypeScript settings
- [ ] 1.3 Update root `package.json` with workspaces configuration

## 2. Set up @yeseh/cortex-core package

- [ ] 2.1 Move `src/core/` to `packages/core/src/` (excluding `storage/filesystem/`)
- [ ] 2.2 Create `packages/core/package.json` with name `@yeseh/cortex-core`
- [ ] 2.3 Create `packages/core/tsconfig.json` extending base
- [ ] 2.4 Configure exports field for public API
- [ ] 2.5 Create `packages/core/README.md`

## 3. Set up @yeseh/cortex-storage-fs package

- [ ] 3.1 Move `src/core/storage/filesystem/` to `packages/storage-fs/src/`
- [ ] 3.2 Create `packages/storage-fs/package.json` with name `@yeseh/cortex-storage-fs`
- [ ] 3.3 Add `@yeseh/cortex-core` as peer dependency
- [ ] 3.4 Create `packages/storage-fs/tsconfig.json` extending base
- [ ] 3.5 Create `packages/storage-fs/README.md`

## 4. Set up @yeseh/cortex-cli package

- [ ] 4.1 Move `src/cli/` to `packages/cli/src/`
- [ ] 4.2 Create `packages/cli/package.json` with name `@yeseh/cortex-cli`
- [ ] 4.3 Add `@yeseh/cortex-core` and `@yeseh/cortex-storage-fs` as dependencies
- [ ] 4.4 Configure `bin` field for `cortex` command
- [ ] 4.5 Create `packages/cli/tsconfig.json` extending base
- [ ] 4.6 Create `packages/cli/README.md`

## 5. Set up @yeseh/cortex-server package

- [ ] 5.1 Move `src/server/` to `packages/server/src/`
- [ ] 5.2 Create `packages/server/package.json` with name `@yeseh/cortex-server`
- [ ] 5.3 Add `@yeseh/cortex-core` and `@yeseh/cortex-storage-fs` as dependencies
- [ ] 5.4 Configure `bin` field for `cortex-mcp` command
- [ ] 5.5 Create `packages/server/tsconfig.json` extending base
- [ ] 5.6 Create `packages/server/README.md`

## 6. Update import paths

- [ ] 6.1 Update imports in `packages/storage-fs/` to use `@yeseh/cortex-core`
- [ ] 6.2 Update imports in `packages/cli/` to use package names
- [ ] 6.3 Update imports in `packages/server/` to use package names
- [ ] 6.4 Update any internal core imports as needed

## 7. Configure root workspace

- [ ] 7.1 Update root `package.json` scripts for workspace commands
- [ ] 7.2 Keep ESLint config at root (shared)
- [ ] 7.3 Keep Prettier config at root (shared)
- [ ] 7.4 Remove old `src/` directory after verification

## 8. Validation

- [ ] 8.1 Run `bun install` to link workspaces
- [ ] 8.2 Run type checking across all packages
- [ ] 8.3 Run tests in each package
- [ ] 8.4 Verify build outputs for each package
- [ ] 8.5 Test local package linking works correctly

## 9. Documentation

- [ ] 9.1 Update root README.md with monorepo structure overview
- [ ] 9.2 Document installation instructions for each package
- [ ] 9.3 Document development workflow for contributors
