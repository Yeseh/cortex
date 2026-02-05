---
created_at: 2026-02-05T19:13:09.512Z
updated_at: 2026-02-05T19:13:09.512Z
tags:
  - map
  - cli
  - commands
source: mcp
---
# CLI Package (@yeseh/cortex-cli)

**Path**: packages/cli
**Purpose**: Command-line interface for interacting with Cortex

## Command Groups
- `memory` - CRUD operations on memories
  - add, show, update, remove, move, list
- `store` - Store management
  - list, add, remove, init, prune, reindex

## Entry Points
- `src/run.ts` - CLI entry point
- `src/program.ts` - Commander.js program definition

## Dependencies
- @yeseh/cortex-core: Domain logic
- @yeseh/cortex-storage-fs: Storage implementation
- commander: CLI framework
- @commander-js/extra-typings: Type-safe commands