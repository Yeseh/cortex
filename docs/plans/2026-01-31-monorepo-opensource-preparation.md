# Monorepo & Open-Source Preparation Brainstorming Summary

**Date**: 2026-01-31  
**Session ID**: ses_3ebc52f5fffeOJizmRINwismdM  
**Goal**: Prepare Cortex for open-source release by converting to a Bun workspaces monorepo with multiple publishable packages

---

## Executive Summary

This document captures the brainstorming session for restructuring Cortex from a single-package project into a multi-package monorepo using Bun workspaces. The restructuring focuses on **organization, tooling, and workflow** only—no functional changes to the codebase.

---

## Current State Analysis

### Project Structure (Before)

```
cortex/
├── src/
│   ├── core/                    # Domain logic, storage ports, filesystem adapter
│   │   ├── memory/              # Memory operations
│   │   ├── category/            # Category operations
│   │   ├── store/               # Store resolution, registry
│   │   └── storage/
│   │       ├── adapter.ts       # Interface definitions (ISP-based ports)
│   │       └── filesystem/      # Filesystem implementation
│   ├── cli/                     # CLI application (Commander.js)
│   └── server/                  # MCP server (Express + MCP SDK)
├── bin/                         # Compiled binaries
├── openspec/                    # Specifications
├── .github/workflows/           # Separate CI per module (core.yml, cli.yml, mcp-server.yml)
├── package.json                 # Single package.json
└── tsconfig.json                # Single tsconfig
```

### Key Observations

- Logical separation already exists (`core/`, `cli/`, `server/`)
- Filesystem storage implementation is nested inside core
- Direct relative imports between modules (`../../core/...`)
- Single `package.json` with all dependencies
- Separate CI workflows per module with path-based triggers
- Tests co-located with source files

---

## Target State

### Package Structure (After)

```
cortex/
├── packages/
│   ├── core/                    # @yeseh/cortex-core
│   │   ├── src/
│   │   │   ├── memory/
│   │   │   ├── category/
│   │   │   ├── store/
│   │   │   └── storage/
│   │   │       └── adapter.ts   # Ports only (no implementations)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── storage-fs/              # @yeseh/cortex-storage-fs
│   │   ├── src/
│   │   │   └── filesystem/      # Moved from core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── cli/                     # @yeseh/cortex-cli
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   └── server/                  # @yeseh/cortex-server
│       ├── src/
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── openspec/                    # Stays at root
├── .github/workflows/           # Updated for monorepo
├── package.json                 # Workspace root
├── tsconfig.base.json           # Shared TypeScript config
├── eslint.config.js             # Shared (stays at root)
├── .prettierrc                  # Shared (stays at root)
└── README.md                    # Monorepo overview
```

### Dependency Graph

```
@yeseh/cortex-storage-fs
       │
       ▼
@yeseh/cortex-core ◄──────┬──────────────┐
                          │              │
                   @yeseh/cortex-cli   @yeseh/cortex-server
```

---

## Confirmed Decisions

### 1. Package Configuration

| Aspect        | Decision                                                          |
| ------------- | ----------------------------------------------------------------- |
| Package scope | `@yeseh/cortex-*`                                                 |
| Registry      | GitHub Packages                                                   |
| Package names | `cortex-core`, `cortex-storage-fs`, `cortex-cli`, `cortex-server` |

### 2. Workspace & Build

| Aspect                  | Decision                                          |
| ----------------------- | ------------------------------------------------- |
| Workspace config        | `package.json` `workspaces` field                 |
| Monorepo tool           | Bun workspaces                                    |
| TypeScript declarations | Emit `.d.ts` via `tsc` with `emitDeclarationOnly` |
| Build tool              | Bun for JS, `tsc` for type declarations           |

### 3. Versioning & Release

| Aspect             | Decision                         |
| ------------------ | -------------------------------- |
| Version strategy   | Synchronized across all packages |
| Version management | Changesets                       |
| Publish trigger    | Tagged releases only             |

### 4. Configuration Sharing

| Config     | Location                                                               |
| ---------- | ---------------------------------------------------------------------- |
| ESLint     | Root (shared)                                                          |
| Prettier   | Root (shared)                                                          |
| TypeScript | `tsconfig.base.json` at root, per-package `tsconfig.json` extends base |
| OpenSpec   | Root (unchanged)                                                       |

### 5. Testing

| Aspect         | Decision                                             |
| -------------- | ---------------------------------------------------- |
| Test location  | Co-located with source                               |
| Test exclusion | Excluded from build/bundle via tsconfig/build config |
| Test runner    | Bun's built-in test runner                           |

### 6. Documentation

| Document        | Decision                    |
| --------------- | --------------------------- |
| Root README     | Monorepo structure overview |
| Package READMEs | Yes, one per package        |
| License         | TBD (before public release) |

### 7. Installation Method

```bash
# Users install CLI globally
bun add -g @yeseh/cortex-cli

# Users install MCP server globally
bun add -g @yeseh/cortex-server
```

---

## Root-Level Scripts

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

---

## CI/CD Workflow Design

### Publish Flow (Tagged Releases)

```yaml
# .github/workflows/release.yml
on:
    push:
        tags:
            - 'v*'

jobs:
    release:
        steps:
            - uses: actions/checkout@v4
            - uses: oven-sh/setup-bun@v2
            - run: bun install
            - run: bun run build
            - run: bun run test
            - run: bun changeset publish
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### CI Flow (PRs and Main)

- Lint all packages
- Typecheck all packages
- Test all packages
- Build all packages

---

## Deferred Items / Separate Changes Needed

### 1. Storage Abstraction Refactor (IMPORTANT)

**Current State**: CLI and Server directly import and use the filesystem storage implementation.

**Target State**: CLI and Server should depend only on `@yeseh/cortex-core` (storage ports), not `@yeseh/cortex-storage-fs`. They should receive a storage adapter via dependency injection or configuration.

**Why Deferred**: This is a functional/architectural change, not organizational. It should be a separate change proposal.

**Action Required**: Create a separate change proposal for abstracting storage from CLI/Server before or after the monorepo conversion.

### 2. Compiled Binaries Workflow

Current `bun build --compile` creates standalone binaries. Future enhancement to:

- Create GitHub releases with binaries
- Possibly a separate installer package

### 3. Dual Publishing to npm Public

After GitHub Packages is working, consider also publishing to npm public registry to avoid authentication requirements for consumers.

### 4. Bundle Size Tracking

Add CI step to report bundle sizes and prevent bloat.

### 5. Package Exports Configuration

Decide on strict `exports` field vs allowing deep imports during implementation.

---

## Migration Approach

**Strategy**: Big-bang migration (not incremental)

### High-Level Steps

1. **Create workspace structure**
    - Create `packages/` directory
    - Move source files to appropriate packages
    - Update import paths to use package names

2. **Configure workspaces**
    - Update root `package.json` with workspaces
    - Create per-package `package.json` files
    - Set up `tsconfig.base.json` and per-package configs

3. **Set up Changesets**
    - Install `@changesets/cli`
    - Configure for synchronized versioning
    - Add changeset workflow

4. **Update CI/CD**
    - Create release workflow for tagged releases
    - Update existing workflows for monorepo structure
    - Configure GitHub Packages authentication

5. **Documentation**
    - Create root README with monorepo overview
    - Create per-package READMEs
    - Add CONTRIBUTING.md if needed

6. **Validation**
    - Run all tests
    - Verify build outputs
    - Test local installation

---

## Package Details

### @yeseh/cortex-core

**Purpose**: Domain logic, storage port interfaces, shared types

**Contents**:

- `memory/` - Memory operations
- `category/` - Category operations
- `store/` - Store resolution, registry
- `storage/adapter.ts` - Port interfaces only
- Types, config, serialization, validation

**Dependencies**:

- `@toon-format/toon`
- `yaml`
- `zod`

**Exports**: Public API for domain operations

---

### @yeseh/cortex-storage-fs

**Purpose**: Filesystem-based storage adapter implementation

**Contents**:

- `filesystem/` - All filesystem storage implementation files

**Dependencies**:

- `@yeseh/cortex-core` (peer dependency for types/interfaces)

**Exports**: `FilesystemStorageAdapter`

---

### @yeseh/cortex-cli

**Purpose**: Command-line interface for Cortex

**Contents**:

- `commands/` - All CLI commands
- `context.ts`, `errors.ts`, `input.ts`, `output.ts`, etc.

**Dependencies**:

- `@yeseh/cortex-core`
- `@yeseh/cortex-storage-fs` (temporary, until storage abstraction)
- `commander`
- `@commander-js/extra-typings`

**Bin**: `cortex`

---

### @yeseh/cortex-server

**Purpose**: MCP server for AI agent integration

**Contents**:

- `memory/`, `store/`, `category/` - MCP tool registrations
- `mcp.ts`, `config.ts`, `health.ts`

**Dependencies**:

- `@yeseh/cortex-core`
- `@yeseh/cortex-storage-fs` (temporary, until storage abstraction)
- `@modelcontextprotocol/sdk`
- `express`

**Bin**: `cortex-mcp`

---

## Questions Resolved During Session

1. **Storage separation**: Keep ports in core, filesystem implementation in separate package
2. **Package naming**: Use `@yeseh/cortex-*` scope with GitHub Packages
3. **Dependency strategy**: CLI/Server to eventually not depend on storage-fs directly (separate change)
4. **Installation**: Standard npm/bun global install (Option 2)
5. **CI triggers**: Tagged releases only for publishing
6. **Version management**: Changesets for synchronized versioning
7. **Workspace config**: In `package.json` (not separate bunfig.toml)
8. **TypeScript declarations**: `tsc` with `emitDeclarationOnly`
9. **Migration**: Big-bang approach, no incremental
10. **Test organization**: Keep co-located with source

---

## Next Steps

1. Create formal OpenSpec change proposal based on this brainstorming document
2. Create separate change proposal for storage abstraction refactor
3. Implement monorepo conversion
4. Set up Changesets
5. Configure GitHub Packages publishing
6. Create documentation

---

## References

- [Bun Workspaces Documentation](https://bun.sh/docs/install/workspaces)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- Current CI workflows: `.github/workflows/core.yml`, `.github/workflows/cli.yml`, `.github/workflows/mcp-server.yml`
