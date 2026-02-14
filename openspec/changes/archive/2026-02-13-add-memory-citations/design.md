## Context

Memories have no way to reference the source material they describe. Agents loading memories about architectural patterns or coding standards cannot verify whether the knowledge is still accurate. Citations attach verifiable references to memories, enabling just-in-time verification.

This change spans all 4 packages (core, storage-fs, server, cli) but is structurally simple — adding an optional `string[]` field through the existing data pipeline.

**Reference**: [GitHub Issue #17](https://github.com/Yeseh/cortex/issues/17), [GitHub Blog: Agentic Memory](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)

## Goals / Non-Goals

**Goals:**

- Add `citations: string[]` to `MemoryMetadata` as an optional field (defaults to `[]`)
- Support citations in create, update, and get operations across MCP and CLI
- Maintain full backward compatibility with existing memories
- Keep validation light (non-empty strings only)

**Non-Goals:**

- Structured citation types (typed objects distinguishing files vs URLs) — agents can infer format
- Citation verification tooling in Cortex — verification is a prompt-level concern
- Tracking citations in category indexes — not needed; requires `get_memory` to view
- `citation_count` in indexes or list responses

## Decisions

### 1. Simple `string[]` on `MemoryMetadata`

Citations are plain strings. File paths are relative to project root with optional line numbers (`src/types.ts:17`). URLs are full URLs. No structured typing — agents are the primary consumers and can infer format.

**Alternatives considered:**

- Typed objects (`{ type: 'file' | 'url', value: string, line?: number }`) — over-engineered for the use case, adds complexity to frontmatter format
- Separate `fileCitations` and `urlCitations` fields — unnecessary split

### 2. Optional, defaults to `[]`

Backward compatible. Not all memories benefit from citations (identity, preferences). Empty array is the standard default for optional arrays — avoids `undefined` runtime errors. Consistent with `tags` field behavior.

### 3. Overwrite semantics on update

- Passing `citations` replaces the entire array
- Passing `citations: []` clears all citations
- Omitting `citations` preserves existing values

This is consistent with how `tags` already works in `updateMemory`.

### 4. Light validation only

Each citation must be a non-empty string. No format validation (no regex for file paths or URLs). Keeps it simple and avoids false negatives on unusual but valid references.

### 5. Not tracked in indexes

Citations are not added to `index.yaml`. Agents must call `get_memory` to see them. Rationale: citations are a detail of individual memories, not useful for browsing/listing. Avoids index bloat.

### 6. Preserved on memory moves

Citations reference external files/URLs, not anything relative to the memory's own path. Moving a memory does not change its citations.

### 7. Verification is a prompt-level concern

Cortex does not verify citations. The memory skill instructs agents to:

- Check file citations at load time (file exists, lines match)
- Update or remove stale citations
- Not verify URL citations at load time
- Not flag citation-less memories for removal

## Frontmatter Format

```yaml
---
created_at: 2026-01-01T00:00:00.000Z
updated_at: 2026-01-01T00:00:00.000Z
tags: [architecture, patterns]
source: mcp
citations:
    - src/core/memory/types.ts:17
    - https://github.blog/example
---
Memory content here.
```

Serialization: omit `citations` key entirely when the array is empty (clean frontmatter for the common case).

## Affected Files

| Package      | File                                    | Change                                                               |
| ------------ | --------------------------------------- | -------------------------------------------------------------------- |
| `core`       | `src/memory/types.ts`                   | Add `citations: string[]` to `MemoryMetadata`                        |
| `core`       | `src/memory/operations.ts`              | Add `citations?` to `CreateMemoryInput` and `UpdateMemoryInput`      |
| `storage-fs` | `src/memories.ts`                       | Add `citations` to `FrontmatterSchema`, update parse/serialize       |
| `server`     | `src/memory/tools.ts`                   | Add `citations` to add/update input schemas, include in get response |
| `cli`        | `src/commands/memory/add/command.ts`    | Add repeatable `--citation` flag                                     |
| `cli`        | `src/commands/memory/update/command.ts` | Add repeatable `--citation` flag                                     |

## Risks / Trade-offs

- **Stale citations**: File paths and line numbers drift as code evolves. Mitigation: prompt-level verification instructions in the memory skill; agents update/remove stale citations.
- **No structured typing**: Agents must parse citation strings to distinguish files from URLs. Mitigation: format is obvious from content; agents handle this trivially.
- **Default store file citations**: File citations in the default store (`~/.config/cortex/memory`) have no stable project root. Mitigation: documented guidance to avoid file citations in the default store.

## Open Questions

None — all design questions resolved in brainstorm.
