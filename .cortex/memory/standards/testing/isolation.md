---
created_at: 2026-02-05T19:32:46.714Z
updated_at: 2026-02-05T19:32:46.714Z
tags:
  - testing
  - bun-test
  - isolation
  - critical
source: mcp
---
# Test Isolation Critical Rule

NEVER use global module mocking in Bun tests. These mocks persist across test files.

**Anti-pattern:** `mock.module('node:fs/promises')` - leaks to ALL other tests!

**Correct approach:** Use real temporary directories with `mkdtemp()`:
- `beforeEach`: Create unique temp dir with `mkdtemp(join(tmpdir(), 'cortex-test-'))`
- `afterEach`: Clean up with `rm(tempDir, { recursive: true, force: true })`

**Benefits:** Test isolation, parallel execution safety, real behavior testing, easier debugging.