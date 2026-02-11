---
created_at: 2026-02-11T20:21:33.671Z
updated_at: 2026-02-11T20:21:33.671Z
tags:
  - todo
  - refactor
  - api
  - flag-argument
source: mcp
---
Remove the `clear_expiry: boolean` flag argument from `update_memory` (MCP + CLI). Replace with nullable `expires_at` — passing `null` or empty string should clear the expiration. The boolean flag is an anti-pattern (see `human/preferences/coding`).

Affected files:
- `packages/server/src/memory/tools.ts` (updateMemoryInputSchema)
- `packages/cli/src/commands/memory/update/command.ts` (--clear-expiry flag)
- `packages/core/src/memory/operations.ts` (UpdateMemoryInput.clearExpiry)