---
created_at: 2026-01-28T18:58:52.610Z
updated_at: 2026-02-05T20:12:34.075Z
tags:
  - policy
  - paths
  - cross-platform
  - testing
  - windows
  - isAbsolute
source: mcp
---
# Cross-Platform Path Handling

## Rule
Always use `node:os` and `node:path` modules to create cross-platform paths. NEVER hardcode paths with forward slashes or backslashes.

## Correct Patterns
```typescript
import { isAbsolute, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

// Good: Use path.join() for combining path segments
const configPath = join(homedir(), '.config', 'cortex');

// Good: Use path.resolve() for absolute paths
const absolutePath = resolve(baseDir, relativePath);

// Good: Use os.tmpdir() for temp directories
const tempPath = join(tmpdir(), 'cortex-test');

// Good: Use isAbsolute() for path validation
expect(isAbsolute(path)).toBe(true);
```

## Incorrect Patterns
```typescript
// Bad: Hardcoded forward slashes (breaks on Windows)
const path = '/home/user/.config/cortex';

// Bad: Hardcoded backslashes (breaks on Unix)
const path = 'C:\\Users\\user\\.config\\cortex';

// Bad: String concatenation with slashes
const path = baseDir + '/' + fileName;

// Bad: Unix-specific absolute path check (breaks on Windows)
expect(path.startsWith('/')).toBe(true);
```

## Testing Considerations
When writing tests that validate or compare paths:
1. Use `path.isAbsolute()` to check if a path is absolute (works on all platforms)
2. Use a `normalizePath()` helper to convert backslashes to forward slashes when comparing
3. Strip Windows drive letters (e.g., `F:`) when comparing against expected values
4. Or use `path.normalize()` on both expected and actual values

## Reference
- Original rule established after fixing cross-platform test failures in store resolution tests (2026-01-28)
- Extended with `isAbsolute()` guidance after fixing context.spec.ts failures (2026-02-05)