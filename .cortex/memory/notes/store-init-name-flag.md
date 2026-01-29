---
created_at: 2026-01-29T17:41:07.740Z
updated_at: 2026-01-29T17:41:07.740Z
tags:
  - testing
  - cli
  - bug-fix
source: mcp
expires_at: 2026-02-05T18:40:47.000Z
---
# store init CLI Requires --name Flag Outside Git Repos

**Issue**: `cortex store init` tests were failing because they ran in temp directories that weren't git repositories.

**Root cause**: The command auto-detects store name from git repo, but falls back to requiring `--name` flag when not in a git repo.

**Fix**: Updated tests in `src/cli/commands/store.spec.ts` to use `--name` flag:
```typescript
// Before (failed):
buildOptions(['init'])

// After (passes):
buildOptions(['init', '--name', 'test-store'])
```

**File**: `src/cli/commands/store.spec.ts:173-218`