---
created_at: 2026-02-15T12:48:24.185Z
updated_at: 2026-02-15T12:48:24.185Z
tags:
  - bun
  - yaml
  - migration
  - breaking-change
source: mcp
citations:
  - packages/storage-fs/src/memories.ts
  - packages/core/src/serialization.ts
  - .opencode/plans/migrate-to-bun-yaml.md
---
## Decision: Use Bun.YAML instead of npm yaml package

**Date**: 2026-02-15  
**PR**: https://github.com/Yeseh/cortex/pull/30

### Context
Cortex was using the `yaml` npm package (v2.8.2) for YAML parsing and stringifying. Since the project is Bun-native, migrating to Bun's built-in `Bun.YAML` API reduces dependencies.

### Decision
Migrate all YAML operations to use `Bun.YAML.parse()` and `Bun.YAML.stringify()` instead of the npm `yaml` package.

### Files Affected
- `packages/core/src/serialization.ts`
- `packages/storage-fs/src/memories.ts`
- `packages/storage-fs/src/index-serialization.ts`

### Breaking Change
**Duplicate YAML frontmatter keys are no longer rejected.** The npm `yaml` package supported `{ uniqueKeys: true }` option via `parseDocument()` to detect duplicates. Bun.YAML follows YAML 1.2 spec where the last value wins.

### Behavioral Differences
1. **Duplicate keys**: Last value wins (no error)
2. **Array formatting**: Bun.YAML uses flow-style `[a, b, c]` instead of block-style with `- a\n- b\n- c`

### Benefits
- Removed ~300KB `yaml` dependency
- Aligns with Bun-native development philosophy
- Simpler API (global `Bun.YAML`, no import needed)