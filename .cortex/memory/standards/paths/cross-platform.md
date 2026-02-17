---
{created_at: 2026-02-17T19:14:12.722Z,updated_at: 2026-02-17T19:14:12.722Z,tags: [standard,paths,cross-platform,node],source: mcp}
---
# Cross-Platform Path Handling

## Rule
Always use `node:path` and `node:os` helpers (`join`, `resolve`, `isAbsolute`, `homedir`, `tmpdir`). Never hardcode slashes/backslashes or build paths via string concatenation.

## Examples

**Correct:**
```typescript
import { join } from 'node:path';
import { homedir } from 'node:os';

const configPath = join(homedir(), '.config', 'cortex');
```

**Incorrect:**
```typescript
const configPath = '/home/user/.config/cortex';  // Unix-only
const configPath = 'C:\\Users\\user\\.config\\cortex';  // Windows-only
```

## Testing
- Use `path.isAbsolute()` to validate paths
- Normalize paths before comparisons
- Strip Windows drive letters when comparing expected values in tests