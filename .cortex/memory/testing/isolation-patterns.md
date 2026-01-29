---
created_at: 2026-01-28T19:27:34.416Z
updated_at: 2026-01-28T19:27:34.416Z
tags: [testing, best-practices, isolation, bun]
source: mcp
---
# Test Isolation Best Practices

## Anti-Pattern: Global Module Mocking
Never use `mock.module('node:fs/promises')` or similar global mocks in Bun tests. These mocks persist across test files and pollute other tests that depend on the mocked module.

```typescript
// BAD - Don't do this
import { mock } from 'bun:test';
mock.module('node:fs/promises', () => ({
    access: async () => {},  // This mock leaks to ALL other tests!
}));
```

## Correct Pattern: Real Temp Directories
Use real temporary directories with unique names:

```typescript
// GOOD - Use real temp directories
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('my tests', () => {
    let tempDir: string;

    beforeEach(async () => {
        // mkdtemp guarantees unique directory (no collisions)
        tempDir = await mkdtemp(join(tmpdir(), 'my-test-prefix-'));
    });

    afterEach(async () => {
        // Always clean up with force: true for reliability
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
```

## Why This Matters
1. **Isolation**: Each test gets its own directory, no state leakage
2. **Parallelization**: Tests can run in parallel safely
3. **Reliability**: Real filesystem operations test actual behavior
4. **Debugging**: Can inspect actual files during test failures

## Reference
This pattern was established after fixing test isolation issues in the Cortex project (2026-01-28) where `mock.module` caused `categoryExists` to always return `true`.