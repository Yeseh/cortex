---
created_at: 2026-01-31T14:47:36.816Z
updated_at: 2026-01-31T14:47:36.816Z
tags:
  - lint
  - eslint
  - ci
  - server
  - formatting
source: mcp
---
## Server Code Lint Requirements

**Project:** Cortex
**Context:** CI failed on PR #12 due to lint errors in `src/server/memory/resources.ts`

### Requirements
- **Indentation:** 4 spaces (NOT tabs)
- **Quotes:** Single quotes (NOT double quotes)
- **Array formatting:** Specific line break rules for arrays

### Fix Command
```bash
bun run eslint src/server/**/*.ts --fix
```

### Prevention
Always run eslint with `--fix` on server files before pushing:
```bash
bun run eslint <changed-files> --fix
```

### CI Checks
PR checks include: Lint, Build, Test, Type Check - all must pass before merge.