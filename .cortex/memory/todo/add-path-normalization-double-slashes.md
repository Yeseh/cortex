---
created_at: 2026-02-14T21:33:30.965Z
updated_at: 2026-02-14T21:33:30.965Z
tags:
  - enhancement
  - cli
  - low-priority
  - validation
source: mcp
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Add Path Normalization for Double Slashes

## Problem
CLI accepts paths with double slashes (e.g., `test//double-slash`) without normalization or rejection.

## Current Behavior
```bash
cortex memory add "test//double-slash" -c "content"
# Succeeds and creates: test//double-slash.md
```

## Expected Behavior
Option A: Normalize path to `test/double-slash`
Option B: Reject with validation error

## Impact
- Low severity
- Could lead to inconsistent path handling
- May cause issues with path matching or searching
- Files are created and accessible but path looks odd

## Recommendation
Normalize paths to remove consecutive slashes for consistency with filesystem conventions.

## Solution Approach
1. Add path normalization function
2. Apply to all path inputs (add, update, move, etc.)
3. Use Node.js path.normalize() or custom function
4. Document normalization behavior

## Test Case
- TC-CLI-032: Error Handling (Invalid Path)

## Location
- `packages/core/src/path/validation.ts` or similar (path validation)
- `packages/cli/src/handlers/*.ts` (command handlers)