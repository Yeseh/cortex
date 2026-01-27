---
created_at: 2026-01-27T21:35:24.187Z
updated_at: 2026-01-27T21:35:24.187Z
tags: [implementation, cli, store, path-resolution]
source: mcp
---
## Store Path Resolution Implementation

The `cortex store add` command resolves all paths to absolute paths before storing in the registry:

### Path Resolution Logic (src/cli/commands/store.ts)
- `isAbsolutePath()` - detects Unix `/path`, Windows `C:\path`, and UNC `\\server\share` paths
- `resolveStorePath()` - handles tilde expansion and path resolution

### Key Behaviors
- Tilde (`~`) expands to user's home directory
- `~username` syntax is NOT supported (resolves as `<home>/username`)
- Relative paths resolve against `options.cwd`
- Absolute paths are normalized via `resolve()` to handle `..` segments
- Windows UNC paths are detected and preserved

### Test Coverage
- 7 new tests in `store.spec.ts` for path resolution scenarios
- Tests use `resolve()` for expected paths to handle cross-platform normalization