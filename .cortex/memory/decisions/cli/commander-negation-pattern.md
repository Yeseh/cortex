---
created_at: 2026-02-13T18:58:49.840Z
updated_at: 2026-02-13T18:58:49.840Z
tags:
  - decision
  - cli
  - commander
  - pattern
  - pr-20
source: mcp
---
Commander.js `--no-<flag>` negation pattern is used for clearing optional fields in the CLI.

Example: `--no-expires-at` sets `options.expiresAt` to `false` in Commander.js. The handler maps this to `null` in domain types to signal "clear this field", while `undefined` means "keep existing value".

This 3-state pattern (value = set, null = clear, undefined = keep) replaces separate boolean `--clear-<field>` flags, aligning with the "no boolean flag arguments" standard.

Applied in: `packages/cli/src/commands/memory/update/command.ts`
PR: #20