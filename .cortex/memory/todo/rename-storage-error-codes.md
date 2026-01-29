---
created_at: 2026-01-29T18:01:57.753Z
updated_at: 2026-01-29T18:01:57.753Z
tags:
  - todo
  - refactoring
  - error-handling
  - tech-debt
source: mcp
---
# TODO: Rename Storage Error Codes That Leak Implementation Details

## Context
During the analysis of duplicated logic between MCP server and CLI, we identified that some error codes in the storage layer leak implementation details (e.g., `StorageAdapterError` codes like `READ_FAILED`, `WRITE_FAILED`).

## Task
Review and rename error codes across the codebase to use domain-appropriate names that don't leak storage implementation details.

## Files to Review
- `src/core/storage/adapter.ts` - `StorageAdapterErrorCode` type
- `src/core/memory/types.ts` - `MemoryErrorCode` type
- `src/core/category/types.ts` - `CategoryErrorCode` type
- `src/core/store/registry.ts` - Store registry error types

## Considerations
- Error codes should describe the domain problem, not the infrastructure failure
- Consider if `STORAGE_ERROR` is sufficient as a catch-all for infrastructure failures
- Ensure CLI and MCP server error translation remains clean after changes

## Status
Pending - created during core operations consolidation planning