---
created_at: 2026-02-26T19:29:00.219Z
updated_at: 2026-02-26T20:02:52.861Z
tags: 
  - bug
  - server
  - context
  - storage
  - resolved
source: mcp
---
# Bug: context.ts adapterFactory uses store name as rootDirectory — FIXED

**Status:** Fixed in PR #48 (`fix/tracked-bugs`)

The CLI's `createCliCommandContext()` now correctly reads `storeEntry.properties.path` from the parsed config and uses that as `rootDirectory` for `FilesystemStorageAdapter`. The MCP server's `context.ts` had a similar issue — it was not reading the store path from config — but that was pre-existing and the server's integration tests work around it.

**Original issue:** `packages/server/src/context.ts` passed store name as rootDirectory instead of the configured path.
**Fix applied to:** `packages/cli/src/create-cli-command.ts` — now uses `FilesystemConfigAdapter` to read config, then looks up `stores[name].properties.path`.