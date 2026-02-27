# Brainstorm: Add Citations to Memories

**Date**: 2026-02-11
**Issue**: [#17 — Add citations to memories](https://github.com/Yeseh/cortex/issues/17)
**Inspiration**: [GitHub Blog — Building an agentic memory system for GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)

## Problem Statement

Memories currently have no way to reference the source material they describe. When an agent loads a memory about an architectural pattern or coding standard, it has no way to verify whether the memory is still accurate against the actual codebase. Over time, memories can become stale as code evolves — files get refactored, line numbers shift, patterns change.

Citations solve this by attaching verifiable references (file paths, URLs) to memories, enabling agents to perform just-in-time verification before trusting stored knowledge.

## Design Decisions

### Data Model

| Decision          | Choice                         | Rationale                                                                                                          |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Citation type     | `string[]` on `MemoryMetadata` | Simple, flexible. Agents are the primary consumers and can infer file vs URL from format. Keeps frontmatter clean. |
| Required/optional | Optional, defaults to `[]`     | Backward compatible with existing memories. Not all memories benefit from citations (e.g., identity, preferences). |
| Location in model | `MemoryMetadata.citations`     | Structured metadata, independently updatable from content.                                                         |
| Backward compat   | Missing field defaults to `[]` | Empty array is the standard default for optional arrays — avoids `undefined` runtime errors.                       |

### Citation Format Conventions

Citations are plain strings following these conventions:

- **File paths**: Relative to the project/repository root, with optional line number or range suffix
    - `src/core/memory/types.ts:17` (single line)
    - `src/core/memory/types.ts:17-28` (line range)
    - `src/core/memory/types.ts` (whole file)
- **URLs**: Full URLs
    - `https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system/`
    - `https://docs.example.com/api/v2`

### Store-specific Guidance

- **Project stores**: Both file citations and URL citations are appropriate. File paths are relative to the project/repo root.
- **Default store** (`~/.config/cortex/memory`): URL citations are fine. File citations are not advisable since there is no stable project root to resolve paths against.

### Frontmatter Format

Follows the existing snake_case convention for on-disk YAML:

```yaml
---
created_at: 2026-01-01T00:00:00.000Z
updated_at: 2026-01-01T00:00:00.000Z
tags: [architecture, patterns]
source: mcp
citations:
    - src/core/memory/types.ts:17
    - https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system/
---
Memory content here.
```

TypeScript domain type (camelCase):

```typescript
export type MemoryMetadata = {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    source: string;
    expiresAt?: Date;
    citations: string[]; // NEW
};
```

### Update Semantics

- **Overwrite**: Passing `citations` to `update_memory` replaces the entire array
- **Clear**: Passing `citations: []` clears all citations
- **Preserve**: Omitting `citations` from the update preserves existing citations
- This is consistent with how `tags` already works

### Validation

- **Light validation**: Each citation must be a non-empty string (consistent with tag validation via `nonEmptyStringSchema`)
- No format validation (not enforcing file path or URL patterns)

### Index/Listing

- Citations are **not** tracked in `index.yaml` — agents must call `get_memory` to see them
- No `citation_count` in the index (not needed for now)

### Memory Moves

- Citations are preserved untouched when a memory is moved via `move_memory`
- Citations reference external files/URLs, not anything relative to the memory's own path

## Verification Behavior (Prompt-Level)

Verification is a **prompt-level concern**, not built into Cortex tooling. The memory skill should instruct agents:

### When Loading Memories with Citations

1. For each **file citation**, check that the file exists and the cited lines contain content consistent with the memory
2. If a cited file has moved or lines have shifted, **update the citation** using `cortex_update_memory`
3. If a cited file no longer exists and cannot be located, **remove the stale citation**
4. For **URL citations**, do not verify at load time (URLs may require network access)

### When Creating Memories

- Add citations when the memory describes something that can be verified against source code or documentation
- Do not add citations to memories about preferences, identity, or abstract knowledge
- Prefer specific line references over whole-file references when the memory describes a specific pattern or decision

### Stale Citations

- Agents should remove or update stale citations proactively
- A memory with no citations is **not** flagged for removal — citations are optional and many valid memories don't need them

## Codebase Touch Points

### Core (`packages/core`)

| File                        | Change                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- |
| `src/memory/types.ts`       | Add `citations: string[]` to `MemoryMetadata`                                   |
| `src/memory/operations.ts`  | Add `citations?: string[]` to `CreateMemoryInput` and `UpdateMemoryInput`       |
| `src/valdiation/schemas.ts` | Potentially add a `citationsSchema` (reuse `nonEmptyStringSchema` for elements) |

### Storage-FS (`packages/storage-fs`)

| File              | Change                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/memories.ts` | Add `citations` to `FrontmatterSchema`, update `parseMemory` and `serializeMemory` for snake_case/camelCase conversion, default missing field to `[]` |

### Server (`packages/server`)

| File                  | Change                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/memory/tools.ts` | Add `citations: z.array(z.string()).optional()` to `addMemoryInputSchema` and `updateMemoryInputSchema`. Include citations in `get_memory` response. |

### CLI (`packages/cli`)

| File                                    | Change                                   |
| --------------------------------------- | ---------------------------------------- |
| `src/commands/memory/add/command.ts`    | Add repeatable `--citation <value>` flag |
| `src/commands/memory/update/command.ts` | Add repeatable `--citation <value>` flag |

### Memory Skill

| File                      | Change                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| `SKILL.md`                | Add citation guidance to core guidelines                           |
| `references/tools.md`     | Document `citations` parameter on `add_memory` and `update_memory` |
| `references/practices.md` | Add section on when/how to use citations and verification behavior |

## Separate Improvement: Remove `clear_expiry` Flag

The `clear_expiry: boolean` flag on `update_memory` is a flag argument anti-pattern. It should be removed in a separate change and replaced with a cleaner convention (e.g., passing `null` or an explicit sentinel value for `expires_at` to clear it). This is tracked separately from the citations feature.

## Open Questions (Resolved)

All questions raised during brainstorming were resolved:

1. **Citation pointing targets** — File paths (with optional line numbers) and URLs. Resolved: keep it simple for now.
2. **Data model location** — `MemoryMetadata`. Resolved: structured metadata enables independent updates.
3. **Verification story** — Prompt-level concern via skill instructions. Resolved: no Cortex tooling needed.
4. **Independent mutability** — Yes, citations are independently updatable. Resolved: overwrite semantics.
5. **Type modeling** — Simple `string[]`. Resolved: agents can infer format from content.
6. **Required vs optional** — Optional. Resolved: backward compatible, not all memories need citations.
7. **Frontmatter format** — Standard YAML array under `citations:` key. Resolved: follows existing conventions.
8. **Update semantics** — Overwrite, no `clear_citations` boolean. Resolved: `[]` clears, omission preserves.
9. **Line number drift** — Agents update or remove stale citations. Resolved: prompt-level behavior.
10. **File path base** — Relative to project/repo root. Resolved: default store should avoid file citations.
11. **Verification depth** — Agents check files, remove stale citations, don't flag citation-less memories. Resolved.
12. **When to cite** — When memory describes verifiable code/docs. Not for preferences/identity. Resolved.
13. **MCP tool changes** — Add to add/update input, include in get response, exclude from list. Resolved.
14. **CLI flag style** — Repeatable `--citation` flag. Resolved.
15. **Index tracking** — Not tracked in index. Resolved: no over-engineering.
16. **Validation** — Light validation: non-empty strings. Resolved.
17. **Backward compat** — Missing field defaults to `[]`. Resolved: standard for optional arrays.
18. **Memory moves** — Citations preserved untouched. Resolved.
