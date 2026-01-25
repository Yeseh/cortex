## Context

We need to migrate memories from the existing OpenCode memory system (SQLite + sqlite-vec) to the new Cortex filesystem-based storage. This is a one-time migration to consolidate memory systems.

**Stakeholders**: Users with existing memories in the OpenCode system

**Constraints**:

- Source system must remain functional during migration (read-only access)
- Migration script is standalone, not integrated into Cortex CLI
- Must handle both global and local memories

## Goals / Non-Goals

**Goals**:

- Migrate all existing memories without data loss
- Generate human-readable slugs from content
- Preserve timestamps and tags
- Produce valid Cortex memory files that pass validation

**Non-Goals**:

- Semantic search / vector embeddings (deferred)
- Automatic cleanup of source data
- Bi-directional sync between systems
- Migration of block metadata (descriptions, char limits)

## Decisions

### Decision: Use CLI JSON output as source

**Rationale**: The existing memory CLI already has a `--json` flag that provides structured output. This avoids direct SQLite access and decouples from internal implementation details.

**Alternatives considered**:

1. Direct SQLite access - More complex, tightly coupled to schema
2. Export/import file format - Would require new format definition

### Decision: Generate slugs from content

**Rationale**: Slugs like `powershell-core-scripting` are more meaningful than `memory-1` or preserving numeric IDs like `6`. This improves discoverability and human readability.

**Algorithm**:

```
1. Lowercase the content
2. Remove punctuation and special characters
3. Split into words
4. Filter out stopwords
5. Take first 4-6 significant words
6. Join with hyphens
7. If collision, append -2, -3, etc.
```

**Alternatives considered**:

1. Preserve numeric IDs - Less meaningful, harder to navigate
2. LLM-generated slugs - Adds complexity and external dependency
3. Hash-based slugs - Not human-readable

### Decision: Set source field to "opencode-migration"

**Rationale**: Clearly identifies memories that came from migration vs. those created natively in Cortex. Useful for debugging and auditing.

### Decision: Single-file script in scripts/ directory

**Rationale**: One-time use doesn't justify CLI integration. Keeping it separate makes it easy to remove after migration is complete.

## Data Flow

```
┌─────────────────────────┐
│ OpenCode Memory CLI     │
│ (bun run cli.ts list)   │
└───────────┬─────────────┘
            │ JSON output
            ▼
┌─────────────────────────┐
│ Migration Script        │
│ - Parse JSON            │
│ - Generate slugs        │
│ - Map categories        │
│ - Transform timestamps  │
│ - Convert tags          │
└───────────┬─────────────┘
            │ Write files
            ▼
┌─────────────────────────┐
│ Cortex Filesystem       │
│ ~/.config/cortex/memory │
│ ├── memories/           │
│ │   ├── global/         │
│ │   │   ├── persona/    │
│ │   │   └── human/      │
│ │   └── projects/       │
│ └── indexes/            │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Cortex Reindex          │
│ (build category indexes)│
└─────────────────────────┘
```

## Risks / Trade-offs

| Risk                            | Mitigation                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| Slug collisions cause data loss | Track used slugs per category, append suffix for collisions      |
| Source CLI unavailable          | Validate CLI path before starting, provide clear error           |
| Malformed source data           | Validate JSON structure, skip invalid entries with warning       |
| Interrupted migration           | Dry-run mode for preview, idempotent writes (overwrite existing) |
| Generated slugs too long        | Limit to 4-6 words, truncate if needed                           |

## Open Questions

1. **Should we support incremental migration?** - Decided: No, one-time migration is sufficient
2. **Should we migrate block metadata (descriptions)?** - Decided: No, focus on memory content only
