---
{created_at: 2026-02-11T20:21:33.671Z,updated_at: 2026-02-17T19:15:07.954Z,tags: [todo,completed,refactor,api,pr-20],source: mcp,expires_at: 2026-05-17T23:59:59.000Z}
---
COMPLETED — PR #20 (refactor/remove-clear-expiry-flag branch)

Removed `clear_expiry` / `clearExpiry` boolean flag from update_memory across core, MCP server, and CLI. Replaced with 3-state nullable `expiresAt`: Date = set, null = clear, undefined = keep. CLI uses `--no-expires-at` Commander.js negation flag.

All 866 tests pass, typecheck clean.