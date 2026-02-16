---
{created_at: 2026-02-16T20:54:04.305Z,updated_at: 2026-02-16T20:55:24.784Z,tags: [bun,file-operations,standards],source: mcp,citations: [packages/core/src/cortex/cortex.ts,packages/core/src/cortex/cortex.spec.ts]}
---
# Standard: Bun-Native File Operations

Use Bun APIs instead of Node.js `fs` module.

## Quick Reference

| Operation | Use | Avoid |
|-----------|-----|-------|
| Read file | `await Bun.file(path).text()` | `readFile(path, 'utf8')` |
| Write file | `await Bun.write(path, content)` | `writeFile(path, content)` |
| File exists | `await Bun.file(path).exists()` | `fs.access()` / `fs.stat()` |
| Parse YAML | `Bun.YAML.parse(str)` | `yaml.parse(str)` |
| Stringify YAML | `Bun.YAML.stringify(obj)` | `yaml.stringify(obj)` |
| Home directory | `import { homedir } from 'os'` | `Bun.env.HOME` |

## Home Directory

Use Bun's native `os` module:

```typescript
import { homedir } from 'os';
const home = homedir();
```

**Note:** Bun provides a native `os` module with `homedir()`. Prefer this over `Bun.env.HOME` for cross-platform reliability.

## Exceptions (Still Use Node.js-style imports)

- `path` — `join`, `resolve`, `isAbsolute` (Bun provides native implementation)
- `os` — `homedir`, `tmpdir` (Bun provides native implementation)
- `mkdir({ recursive: true })` — for nested directory creation