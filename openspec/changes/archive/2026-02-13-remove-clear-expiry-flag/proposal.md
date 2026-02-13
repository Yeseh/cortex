# Change: Remove `clear_expiry` boolean flag from update operations

## Why

The `clear_expiry` / `clearExpiry` boolean flag on memory update operations violates the project's "no boolean flag arguments" coding standard (AGENTS.md line 105) and the update-semantics standard which states: "There should be no separate 'clear' boolean flags — passing the empty/null representation of the type is sufficient to clear."

## What Changes

- **BREAKING**: Remove `clearExpiry` field from core `UpdateMemoryInput` interface
- **BREAKING**: Remove `clear_expiry` parameter from MCP `update_memory` tool schema
- **BREAKING**: Remove `--clear-expiry` / `-E` CLI flag from `memory update` command
- Make `expiresAt` on `UpdateMemoryInput` accept `Date | null` (3-state: `Date` = set, `null` = clear, `undefined` = keep)
- Make MCP `expires_at` accept `null` to clear expiration
- Add `--no-expires-at` CLI flag (Commander.js negation) to clear expiration

## Impact

- Affected specs: `mcp-memory-tools`, `cli-memory`
- Affected code:
    - `packages/core/src/memory/operations.ts` (interface + logic)
    - `packages/core/src/memory/operations.spec.ts` (tests)
    - `packages/server/src/memory/tools.ts` (schema + handler + types)
    - `packages/server/src/memory/tools.spec.ts` (tests)
    - `packages/cli/src/commands/memory/update/command.ts` (flag + handler)
    - `packages/cli/src/tests/cli.integration.spec.ts` (tests)
    - `scripts/acceptance-test.ps1` (acceptance test)
