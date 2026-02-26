---
created_at: 2026-02-26T19:29:00.219Z
updated_at: 2026-02-26T19:29:00.219Z
tags: 
  - bug
  - server
  - context
  - storage
source: mcp
---
# Bug: context.ts adapterFactory uses store name as rootDirectory

In `packages/server/src/context.ts`, the `adapterFactory` closure passes the store name (e.g. `'default'`) as the `rootDirectory` to `FilesystemStorageAdapter` instead of looking up the configured path from `config.stores[name].properties.path`.

This means the adapter resolves relative to CWD instead of the configured absolute path.

**Location:** `context.ts` ~line 117–120
**Impact:** Server works in production only because CWD happens to be the right place, or via workarounds in tests.
**Fix needed:** Read `config.stores[storeName].properties.path` and use that as `rootDirectory`.

Discovered while writing `index.spec.ts` — tests use `withCwd()` workaround to compensate.