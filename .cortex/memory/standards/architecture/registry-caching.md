---
{created_at: 2026-02-17T19:14:18.163Z,updated_at: 2026-02-17T19:14:18.163Z,tags: [standard,architecture,registry,caching],source: mcp}
---
# Registry Caching Pattern

## Rule
Registry implementations cache loaded data so `getStore()` can be synchronous. Call `load()` once, then reuse `getStore()` without re-reading disk.

## Usage
1. Call `registry.load()` early in application startup
2. Treat `getStore()` as synchronous after load
3. If `load()` is skipped, return `REGISTRY_NOT_LOADED` error

## Reference
`packages/core/src/storage/filesystem/filesystem-registry.ts`