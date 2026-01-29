---
created_at: 2026-01-29T20:11:50.728Z
updated_at: 2026-01-29T20:11:50.728Z
tags:
  - cli
  - errors
  - patterns
source: mcp
---
# CLI Error Mapping Pattern

## Overview
The `mapCoreError()` function in `src/cli/errors.ts` maps domain errors to Commander.js exceptions.

## Error Categories

### Argument Errors (show usage help)
Mapped to `InvalidArgumentError`:
- `INVALID_PATH` - Path validation failed
- `INVALID_ARGUMENTS` - Argument parsing errors
- `INVALID_STORE_NAME` - Invalid store name format
- `INVALID_STORE_PATH` - Invalid store path
- `MISSING_CONTENT` - Content required but not provided
- `MULTIPLE_CONTENT_SOURCES` - Both --content and --file provided
- `GIT_REPO_REQUIRED` - Need --name when not in git repo

### System Errors (show error only)
Mapped to `CommanderError`:
- All other error codes (file not found, write failed, etc.)

## Usage
```typescript
const result = await someOperation();
if (!result.ok) {
    mapCoreError(result.error);  // throws, never returns
}
```

## Note
Use `INVALID_ARGUMENTS` (not `INVALID_ARGS`) for consistency.