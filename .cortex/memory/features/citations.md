---
created_at: 2026-02-11T20:19:07.374Z
updated_at: 2026-02-13T18:44:42.930Z
tags:
  - feature
  - citations
  - memory
  - design
  - openspec
source: mcp
---
# Memory Citations (Issue #17)

Add `citations: string[]` to `MemoryMetadata` for verifiable source references.

## Design
- Simple string array: file paths (relative to project root, optional line numbers) and URLs
- Optional field, defaults to `[]`
- Stored in frontmatter as `citations:` (snake_case on disk)
- Overwrite semantics on update; `[]` clears, omission preserves
- Light validation: non-empty strings only
- Not tracked in index; requires `get_memory` to view
- Preserved untouched on memory moves

## Verification
- Prompt-level concern via memory skill instructions
- Agents verify file citations at load time, update/remove stale ones
- URL citations not verified at load time
- Citation-less memories are not flagged for removal

## Touch Points
- Core: `MemoryMetadata`, `CreateMemoryInput`, `UpdateMemoryInput`
- Storage-FS: `FrontmatterSchema`, `parseMemory`, `serializeMemory`
- Server: `addMemoryInputSchema`, `updateMemoryInputSchema`
- CLI: repeatable `--citation` flag on add/update commands
- Memory skill: citation guidance in SKILL.md, tools.md, practices.md

## Related
- OpenSpec proposal: `openspec/changes/add-memory-citations/`
- Affected specs: `memory-core`, `storage-filesystem`, `mcp-memory-tools`, `cli-memory`
- Full brainstorm: `.context/citations-brainstorm.md`
- Separate TODO: remove `clear_expiry` boolean flag anti-pattern