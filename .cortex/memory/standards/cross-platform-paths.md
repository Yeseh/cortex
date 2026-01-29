---
created_at: 2026-01-28T18:58:52.610Z
updated_at: 2026-01-28T18:58:52.610Z
tags: [policy, paths, cross-platform, testing, windows]
source: mcp
---
# Cross-Platform Path Handling

## Rule
Always use `node:os` and `node:path` modules to create cross-platform paths. NEVER hardcode paths with forward slashes or backslashes.

## Correct Patterns
```typescript
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

// Good: Use path.join() for combining path segments
const configPath = join(homedir(), '.config', 'cortex');

// Good: Use path.resolve() for absolute paths
const absolutePath = resolve(baseDir, relativePath);

// Good: Use os.tmpdir() for temp directories
const tempPath = join(tmpdir(), 'cortex-test');
```

## Incorrect Patterns
```typescript
// Bad: Hardcoded forward slashes (breaks on Windows)
const path = '/home/user/.config/cortex';

// Bad: Hardcoded backslashes (breaks on Unix)
const path = 'C:\\Users\\user\\.config\\cortex';

// Bad: String concatenation with slashes
const path = baseDir + '/' + fileName;
```

## Testing Considerations
When writing tests that compare paths:
1. Use a `normalizePath()` helper to convert backslashes to forward slashes
2. Strip Windows drive letters (e.g., `F:`) when comparing against expected values
3. Or use `path.normalize()` on both expected and actual values

## Reference
This rule was established after fixing cross-platform test failures in the store resolution tests (2026-01-28).