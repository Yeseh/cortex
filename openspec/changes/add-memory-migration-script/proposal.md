# Change: Add memory migration script

## Why

The existing memory system in `~/.config/opencode/skills/memory` uses SQLite with sqlite-vec for storage. We are consolidating all memory management into Cortex as the single source of truth, using filesystem-based storage with markdown files and YAML frontmatter. A one-time migration script is needed to transfer existing memories to the new Cortex format.

## What Changes

- Add a standalone migration script (`scripts/migrate-opencode-memory.ts`)
- Script reads from existing SQLite-based memory system via CLI `--json` output
- Script writes to new Cortex filesystem structure at `~/.config/cortex/memory/`
- Script generates meaningful slugs from memory content
- Script preserves timestamps, tags, and metadata
- Script runs Cortex reindex after migration to build category indexes

## Impact

- Affected specs: None (tooling-only, no spec changes)
- Affected code: New script in `scripts/` directory
- External dependencies: Requires existing memory CLI to be functional during migration

## Background

### Source System (OpenCode Memory)

**Storage**: SQLite with sqlite-vec at:

- Global: `~/.config/opencode/memory/global.db`
- Local: `<project>/.opencode/memory/local.db`

**Data Model**:

- Memory blocks with scope (`global` | `local`)
- Blocks: `persona`, `human`, `project`, `scratch`
- Memory IDs: `<block>-<numeric>` (e.g., `persona-6`)
- Fields: `id`, `block_label`, `text`, `tags` (comma-separated), `created_at`, `updated_at`

**CLI Interface**:

```bash
bun run skills/memory/cli.ts list --scope global --json
bun run skills/memory/cli.ts list --scope local --block project --json
```

### Target System (Cortex)

**Storage**: Filesystem at `~/.config/cortex/memory/`

- `memories/` - markdown files with YAML frontmatter
- `indexes/` - YAML category indexes

**Data Model**:

- Hierarchical categories with unlimited depth
- Slug-based identity (e.g., `global/persona/communication-style`)
- Frontmatter: `created_at`, `updated_at`, `tags` (array), `source`, optional `expires_at`

### Category Mapping

| Source Block | Source Scope | Target Path                              |
| ------------ | ------------ | ---------------------------------------- |
| `persona`    | global       | `global/persona/<slug>`                  |
| `human`      | global       | `global/human/<slug>`                    |
| `project`    | local        | `projects/<project-name>/project/<slug>` |
| `scratch`    | local        | `projects/<project-name>/scratch/<slug>` |

### Slug Generation Strategy

1. Extract content text
2. Remove stopwords (a, an, the, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, could, should, may, might, must, shall, can, need, dare, ought, used, etc.)
3. Extract first 4-6 significant words
4. Convert to kebab-case, lowercase
5. Handle collisions by appending `-2`, `-3`, etc.

**Example**:

```
Content: "User prefers PowerShell Core (pwsh) for scripting on Windows to ensure cross-platform compatibility"
Slug: "powershell-core-scripting-windows"
```

### Frontmatter Mapping

| Source Field | Target Field | Transformation                      |
| ------------ | ------------ | ----------------------------------- |
| `created_at` | `created_at` | Unix timestamp → ISO 8601           |
| `updated_at` | `updated_at` | Unix timestamp → ISO 8601           |
| `tags`       | `tags`       | Comma-separated string → YAML array |
| (new)        | `source`     | Set to `"opencode-migration"`       |

## Non-Goals

- Semantic search / vector embeddings (deferred)
- Automatic cleanup of old SQLite files (user responsibility)
- Integration into Cortex CLI (one-time script only)
- Migration of local project memories (focus on global first, can extend later)
