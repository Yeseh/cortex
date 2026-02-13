---
created_at: 2026-02-13T19:52:48.750Z
updated_at: 2026-02-13T19:52:48.750Z
tags: []
source: mcp
---
Usage: call registry.load() early and treat getStore() as sync; if load is skipped, return REGISTRY_NOT_LOADED. Reference: packages/core/src/storage/filesystem/filesystem-registry.ts.