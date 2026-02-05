---
created_at: 2026-02-05T19:12:56.276Z
updated_at: 2026-02-05T19:12:56.276Z
tags:
  - map
  - overview
  - architecture
source: mcp
---
# Cortex Project Map

**Type**: Monorepo (npm workspaces + Bun)
**Purpose**: Hierarchical memory system for AI coding agents

## Package Structure
- `packages/core` - @yeseh/cortex-core: Core domain logic, types, validation
- `packages/storage-fs` - @yeseh/cortex-storage-fs: Filesystem storage adapter
- `packages/cli` - @yeseh/cortex-cli: Command-line interface
- `packages/server` - @yeseh/cortex-server: MCP server for AI agent integration

## Key Technologies
- Runtime: Bun
- Language: TypeScript (ESM)
- Testing: Bun test
- Schema validation: Zod
- CLI framework: Commander.js
- MCP: Model Context Protocol SDK
- Package management: Changesets

## Store Resolution Order
1. Explicit: --store flag
2. Local: .cortex/memory in cwd
3. Global: ~/.config/cortex/memory