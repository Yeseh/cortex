---
created_at: 2026-01-29T16:45:00.106Z
updated_at: 2026-01-29T16:45:00.106Z
tags: [decision, store-init, cli, feature]
source: mcp
---
# Store Init Project Support Decision

## Date
2026-01-29

## Decision
Enhanced `cortex store init` command to auto-detect git repository names and auto-register stores in the global registry.

## Key Implementation Details

### Name Resolution Priority
1. Explicit `--name` flag (highest priority)
2. Git repository name detection (`git rev-parse --show-toplevel`)
3. Error requiring `--name` if not in git repo

### Git Name Normalization
Git repo names are normalized to valid store names:
- Converted to lowercase
- Non-alphanumeric characters replaced with hyphens
- Leading/trailing hyphens removed

### Project Entry Creation
After successful init, a best-effort project entry is created at `projects/{store-name}` in the default store. This is non-blocking - failures don't affect the main init operation.

### Security Consideration
`spawn('git', args, { cwd })` is used WITHOUT `shell: true` to prevent command injection vulnerabilities.

## Files Changed
- `src/cli/commands/store.ts` - Main implementation
- `src/cli/output.ts` - Added `name` to `OutputStoreInit`
- `src/cli/commands/help.ts` - Updated help text
- `src/cli/commands/store.test.ts` - 29 new tests

## PR
https://github.com/Yeseh/cortex/pull/3