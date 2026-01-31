## Context

Cortex is transitioning from a single-package project to a multi-package monorepo to support independent publishing and clearer separation of concerns. This design document captures the technical decisions for the restructure.

## Goals / Non-Goals

**Goals:**

- Enable independent npm publishing of packages to GitHub Packages
- Support global installation of CLI and MCP server
- Maintain shared tooling (ESLint, Prettier) at repository root
- Use Bun workspaces for local development linking

**Non-Goals:**

- Functional changes to any existing code
- Storage abstraction refactoring (separate proposal)
- Publishing to npm public registry (future enhancement)

## Decisions

### Package Naming Convention

- **Decision**: Use `@yeseh/cortex-*` scope with GitHub Packages
- **Alternatives**:
    - `cortex-*` (no scope) - Less namespace protection
    - `@cortex/*` (different scope) - Name already taken
- **Rationale**: Scope provides namespace, matches repo owner

### Build Tool Strategy

- **Decision**: Bun for JS bundling, `tsc` with `emitDeclarationOnly` for type declarations
- **Alternatives**:
    - `tsc` only - Slower, doesn't leverage Bun's bundler
    - Bun only - No reliable `.d.ts` generation
- **Rationale**: Best of both worlds - Bun speed for runtime, tsc accuracy for types

### Workspace Configuration

- **Decision**: Use `package.json` `workspaces` field
- **Alternatives**:
    - `bunfig.toml` workspace config
    - Separate monorepo tool (Turborepo, Nx)
- **Rationale**: Native Bun support, zero additional tooling

### Test Location

- **Decision**: Tests remain co-located with source files (`*.spec.ts`)
- **Alternatives**:
    - Separate `tests/` directory per package
    - Root-level `tests/` directory
- **Rationale**: Maintains existing convention, easier to find related tests

### Configuration Sharing

- **Decision**:
    - `tsconfig.base.json` at root, extended by per-package configs
    - ESLint and Prettier configs remain at root only
- **Rationale**: TypeScript needs per-package paths; lint/format can be global

### Storage Package Separation

- **Decision**: Extract filesystem implementation to `@yeseh/cortex-storage-fs`
- **Alternatives**:
    - Keep in core with optional import
    - Create generic `@yeseh/cortex-storage` package
- **Rationale**: Follows ISP, allows future storage backends without core changes

## Package Structure

```
packages/
├── core/                    # @yeseh/cortex-core
│   └── src/
│       ├── memory/          # Domain operations
│       ├── category/        # Category operations
│       ├── store/           # Store resolution
│       ├── index/           # Index operations
│       └── storage/
│           └── adapter.ts   # Interfaces only
├── storage-fs/              # @yeseh/cortex-storage-fs
│   └── src/
│       └── filesystem/      # Filesystem implementation
├── cli/                     # @yeseh/cortex-cli
│   └── src/
│       └── commands/        # CLI commands
└── server/                  # @yeseh/cortex-server
    └── src/
        └── memory/          # MCP tools
```

## Dependency Graph

```
@yeseh/cortex-storage-fs ─┐
                          ▼
               @yeseh/cortex-core
                    ▲          ▲
                    │          │
         @yeseh/cortex-cli   @yeseh/cortex-server
```

Note: CLI and Server currently import storage-fs directly. This is a temporary coupling that will be addressed in a separate storage abstraction proposal.

## Root Scripts

```json
{
    "scripts": {
        "build": "bun run --filter '*' build",
        "test": "bun run --filter '*' test",
        "test:core": "bun test packages/core",
        "test:cli": "bun test packages/cli",
        "test:server": "bun test packages/server",
        "test:storage-fs": "bun test packages/storage-fs",
        "lint": "eslint packages/*/src/**/*.ts --fix",
        "format": "prettier --write \"packages/*/src/**/*.{ts,json,md}\"",
        "typecheck": "tsc --build",
        "clean": "rm -rf packages/*/dist"
    }
}
```

## Risks / Trade-offs

| Risk                           | Mitigation                                       |
| ------------------------------ | ------------------------------------------------ |
| Import path refactoring errors | Comprehensive test suite, TypeScript strict mode |
| Workspace linking issues       | Validate with `bun install` before proceeding    |
| Build order dependencies       | Configure proper `references` in tsconfig.json   |
| Missing exports                | Explicit `exports` field in package.json         |

## Migration Plan

1. Create structure without moving files
2. Move files package-by-package with verification
3. Update imports after each package move
4. Run full test suite after each major step
5. Rollback: Single commit can revert entire structure

## Open Questions

- [ ] Should we add `sideEffects: false` for tree-shaking? (Likely yes)
- [ ] Exact `exports` field structure for each package?
