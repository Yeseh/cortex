---
tags:
    - bug
    - windows
    - path
    - test
expires: 2026-02-12
---

# Windows Path Tests Failing

## Issue

Two tests in `packages/cli/src/context.spec.ts` fail on Windows:

- Line 28: `getDefaultGlobalStorePath` - checks `path.startsWith('/')`
- Line 51: `getDefaultRegistryPath` - checks `path.startsWith('/')`

## Cause

Tests assume Unix-style absolute paths starting with `/`, but Windows paths start with drive letters like `C:\`.

## Fix

Use `path.isAbsolute()` from Node's path module instead of checking for `/` prefix.

```typescript
// Before (fails on Windows)
expect(path.startsWith('/')).toBe(true);

// After (works cross-platform)
import { isAbsolute } from 'node:path';
expect(isAbsolute(path)).toBe(true);
```
