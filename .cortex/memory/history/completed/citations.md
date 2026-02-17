---
created_at: 2026-02-11T20:19:07.374Z
updated_at: 2026-02-13T19:33:26.898Z
tags:
  - feature
  - citations
  - memory
  - implemented
  - pr-21
source: mcp
---
# Memory Citations (Issue #17) — IMPLEMENTED

Add `citations: string[]` to `MemoryMetadata` for verifiable source references.

## Status
- **PR**: https://github.com/Yeseh/cortex/pull/21
- **Branch**: `feat/add-memory-citations`
- **OpenSpec**: `add-memory-citations` (tasks complete)

## Design
- Simple string array: file paths (relative to project root, optional line numbers) and URLs
- Optional field, defaults to `[]`
- Stored in frontmatter as `citations:` (snake_case on disk)
- Overwrite semantics on update; `[]` clears, omission preserves
- Light validation: non-empty strings only
- Not tracked in index; requires `get_memory` to view
- Preserved untouched on memory moves

## Implementation
- Core: `MemoryMetadata`, `CreateMemoryInput`, `UpdateMemoryInput`
- Storage-FS: `FrontmatterSchema`, `parseMemory`, `serializeMemory`
- Server: `addMemoryInputSchema`, `updateMemoryInputSchema`, `getMemoryHandler`
- CLI: repeatable `--citation` flag on add/update commands

## Test Coverage
- Storage-fs: parsing, serialization, round-trip, validation tests
- Server: MCP tool tests for add, get, update with citations
- All 880 tests pass