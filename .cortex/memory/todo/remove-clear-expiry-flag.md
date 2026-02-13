---
created_at: 2026-02-11T20:21:33.671Z
updated_at: 2026-02-13T18:58:28.483Z
tags:
  - todo
  - completed
  - refactor
  - api
  - pr-20
source: mcp
---
COMPLETED — PR #20 (refactor/remove-clear-expiry-flag branch)

Removed `clear_expiry` / `clearExpiry` boolean flag from update_memory across core, MCP server, and CLI. Replaced with 3-state nullable `expiresAt`: Date = set, null = clear, undefined = keep. CLI uses `--no-expires-at` Commander.js negation flag.

All 866 tests pass, typecheck clean.