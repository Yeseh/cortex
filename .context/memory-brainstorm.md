# Cortex Memory System — Design Brainstorm

> **Session ID**: `ses_40f62227fffeP1iYQ6YWMUKpSO`

This document captures the design decisions from brainstorming sessions for the Cortex memory system. It serves as input for creating formal OpenSpec change proposals.

## Overview

Cortex is a comprehensive, frontend-agnostic memory system for AI agents. It evolves from and replaces the current Opencode memory skill, designed to work with multiple agent frameworks including Opencode, Microsoft Agent Framework, and Azure-hosted agents.

### Goals

- Provide persistent, queryable memory for AI agents
- Frontend-agnostic: CLI first, then HTTP API and MCP server
- Framework-agnostic: works with Opencode, Microsoft Agent Framework, Azure, etc.
- Filesystem-based storage (v1) with interface abstraction for future backends
- Feature-based code organization with independently deployable modules

### Non-Goals (v1)

- Vector/embedding storage and semantic search (deferred to later version)
- SQLite or database backends (deferred)
- Opencode-specific integrations (Cortex knows nothing about Opencode)

---

## Data Model

### Memory Hierarchy

- **Max 2 levels of nesting**: `category/subcategory/memory.md`
- **Memory identity**: Slug-based, path is the ID (e.g., `standards/typescript/eslint-config`)
- **Categories**: Folders containing an `index.yaml` and memory files or subcategories

Example structure:
```
.cortex/
├── config.yaml
├── index.yaml
├── project-management/
│   ├── index.yaml
│   └── sprint-planning.md
└── standards/
    ├── index.yaml
    ├── typescript/
    │   ├── index.yaml
    │   ├── eslint-config.md
    │   └── naming-conventions.md
    └── python/
        ├── index.yaml
        └── formatting.md
```

### Memory File Format

Markdown with YAML frontmatter:

```yaml
---
created_at: 2026-01-24T10:30:00Z
updated_at: 2026-01-24T10:30:00Z
tags: [typescript, eslint, standards]
source: user
token_estimate: 450
expires_at: 2026-06-01T00:00:00Z  # optional
---

Use ESLint with the following configuration for all TypeScript projects...

[full content]
```

### Index File Format

YAML containing paths, token estimates, and optional summaries:

```yaml
# standards/typescript/index.yaml
memories:
  - path: eslint-config
    token_estimate: 234
    summary: ESLint configuration for TypeScript projects  # optional, for large memories
  - path: naming-conventions
    token_estimate: 156

subcategories:
  - path: react
    memory_count: 3
```

### Index Maintenance

- Indexes are maintained on write operations
- Manual `cortex reindex` command available for repair
- No auto-regeneration on read (trust indexes)

---

## Store System

### Named Stores

Stores are named references to filesystem paths. A store is simply a folder with the standard `.cortex/` structure (config, index, categories, memories).

### Store Registry

**`~/.config/cortex/stores.yaml`**:
```yaml
stores:
  global:
    path: ~/.config/cortex/memory
  company-standards:
    path: ~/work/company-standards/.cortex
  team-playbooks:
    path: /shared/team/playbooks
```

### Store Resolution

When no `--store` flag is provided:
1. Look for `./.cortex/` in current working directory
2. If not found and `strict_local: false`, fall back to global store
3. If `strict_local: true`, error instead of fallback

Explicit `--store <name>` overrides this resolution.

---

## Configuration

### Layered Configuration

- Global config at `~/.config/cortex/config.yaml`
- Local config at `.cortex/config.yaml`
- Merge strategy: local overrides global

### Configuration Options

```yaml
# ~/.config/cortex/config.yaml (global)
output_format: yaml              # yaml | json
auto_summary_threshold: 500      # generate summary for memories > N tokens
strict_local: false              # never fall back to global store
```

```yaml
# .cortex/config.yaml (local override)
output_format: json
strict_local: true
```

---

## CLI Interface

### Store Management Commands

No `--store` flag (operates on registry):

```
cortex store list                    # List all registered stores
cortex store add <name> <path>       # Register a new store
cortex store remove <name>           # Unregister a store
cortex store init [path]             # Initialize a store at path (default: ./.cortex)
```

### Memory Operations

`--store <name>` flag available:

```
cortex add <path> [options] [--store <name>]           # Create memory
cortex show <path> [--store <name>] [--include-expired]  # Show memory or category
cortex update <path> [options] [--store <name>]        # Update existing memory
cortex remove <path> [--store <name>]                  # Delete memory
cortex move <from> <to> [--store <name>]               # Move/rename memory
```

#### `cortex add` Input Methods

Content can be provided via:
- **Text argument**: `cortex add path --content "memory content here"`
- **Stdin pipe**: `echo "content" | cortex add path` or `cat file.md | cortex add path`
- **File input**: `cortex add path --file ./notes.md`
- If no content provided, reads from stdin (blocks until EOF)

Categories in the path are created automatically if they don't exist (only on `add`).

#### `cortex update` Options

Update supports granular metadata changes:
```
cortex update <path> [--content "..."]     # Replace content
cortex update <path> [--file ./new.md]     # Replace content from file
cortex update <path> [--tags tag1,tag2]    # Replace tags
cortex update <path> [--expires-at DATE]   # Set/update expiry
cortex update <path> [--clear-expiry]      # Remove expiry
```

Multiple flags can be combined. Content can also be piped via stdin.

### Discovery & Maintenance

`--store <name>` flag available:

```
cortex list [category] [--store <name>] [--include-expired]  # List memories
cortex reindex [--store <name>]                              # Rebuild indexes
cortex prune [--store <name>]                                # Delete expired memories
```

### Store Initialization

`cortex store init [path]` creates:
```
.cortex/
├── config.yaml          # Empty or with commented defaults
└── index.yaml           # Root index (empty)
```

---

## Output Formats

### Single Memory Output

```yaml
# standards/typescript/eslint-config
created_at: 2026-01-24T10:30:00Z
tags: [typescript, eslint]
token_estimate: 234
---
Use ESLint with the following configuration for all TypeScript projects...
[full content]
```

### Category Output

```yaml
# standards/typescript/
memories:
  - path: eslint-config
    token_estimate: 234
    summary: ESLint configuration for TypeScript projects
  - path: naming-conventions
    token_estimate: 156
subcategories:
  - path: react
    memory_count: 3
```

---

## Architecture

### Design Principles

| Principle | Decision |
|-----------|----------|
| **Feature-based organization** | No "Service" or "Manager" naming; organize by domain |
| **Module independence** | Each feature module deployable separately (future MCP/API) |
| **No cross-imports** | Features only import from `core`, orchestration in CLI/facade |
| **Errors as values** | `Result<T, E>` pattern, no thrown exceptions |
| **Strict behavior** | Fail fast, clear errors, no magic auto-creation |
| **Interface-driven** | Storage abstracted behind `StorageAdapter` interface |

### File Layout

```
src/
├── core/                    # Shared foundations (no feature logic)
│   ├── types.ts             # MemoryMetadata, CategoryInfo, StoreConfig, etc.
│   ├── config.ts            # Config loading, merging, validation
│   ├── errors.ts            # Error types for Result<>
│   ├── result.ts            # Result<T, E> implementation
│   ├── slug.ts              # Slug generation/validation
│   ├── tokens.ts            # Tokenizer interface + heuristic implementation
│   └── yaml.ts              # YAML parsing/serialization helpers
│
├── memory/                  # Memory domain
│   ├── memory.ts            # Memory entity, creation, validation
│   ├── category.ts          # Category entity, nesting rules
│   └── types.ts             # Memory-specific types
│
├── store/                   # Store management
│   ├── store.ts             # Store entity, resolution logic
│   ├── registry.ts          # Global store registry
│   └── types.ts             # Store-specific types
│
├── index/                   # Indexing feature
│   ├── index.ts             # Index building, updating
│   ├── parser.ts            # Parse index files
│   └── types.ts             # Index-specific types
│
├── storage/                 # Storage abstraction
│   ├── adapter.ts           # StorageAdapter interface
│   └── filesystem/          # Filesystem implementation (v1)
│       ├── reader.ts
│       ├── writer.ts
│       └── index.ts
│
├── cli/                     # CLI frontend
│   ├── commands/
│   │   ├── store.ts
│   │   ├── add.ts
│   │   ├── show.ts
│   │   ├── update.ts
│   │   ├── remove.ts
│   │   ├── move.ts
│   │   ├── list.ts
│   │   ├── reindex.ts
│   │   └── prune.ts
│   ├── output.ts            # Formatters (yaml, json, future: toon)
│   └── index.ts
│
└── cortex.ts                # Main entry point / facade
```

### Interface Boundaries

```
┌─────────────────────────────────────────────────┐
│  Frontends (CLI, HTTP API, MCP Server)          │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  Cortex Facade (orchestration)                  │
└─────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ memory/ │   │ store/  │   │ index/  │
    └─────────┘   └─────────┘   └─────────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
┌─────────────────────────────────────────────────┐
│  StorageAdapter (interface)                     │
│  └── FilesystemAdapter (v1 implementation)      │
└─────────────────────────────────────────────────┘
```

---

## Error Handling

- **Strict mode**: Fail fast with clear error messages, exit code 1
- **Errors as values**: Use `Result<T, E>` pattern throughout, no thrown exceptions
- **Category auto-creation**: Categories are created automatically only during `cortex add` (not on show/update/remove)
- **Path validation**: Missing paths on read/update operations are errors (prevents typos)

Example Result usage:
```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function getMemory(path: string): Result<Memory, MemoryNotFoundError | InvalidPathError> {
  // ...
}
```

---

## Expiry Handling

- **Auto-hide**: Expired memories are hidden by default from `list` and `show`
- **Include flag**: Use `--include-expired` to show expired memories
- **Prune command**: `cortex prune` deletes all expired memories from a store
- **Expiry is optional**: Memories without `expires_at` never expire

---

## Token Estimation

- **v1 implementation**: Simple heuristic (e.g., `characters / 4`)
- **Abstraction**: Token estimation behind a `Tokenizer` interface
- **Future**: Pluggable tokenizers (tiktoken, cl100k_base, model-specific)
- **Configuration**: Tokenizer selection via config (future)

---

## Future Considerations (out of scope for v1)

- **Semantic search**: Vector embeddings, similarity search across stores
- **SQLite backend**: Alternative to filesystem for performance
- **PostgreSQL + pgvector**: Scalable deployments
- **HTTP API**: REST or GraphQL interface
- **MCP Server**: Model Context Protocol integration
- **TOON format**: Context-optimized output format for agents
- **Cross-store search**: `--all-stores` flag for searching across registry
- **Bulk operations**: Import/export, batch add from directory, recursive category delete
- **Advanced tokenizers**: Configurable model-specific tokenization (tiktoken, etc.)

---

## Open Questions

_None remaining — ready for proposal formalization._

---

## References

- Original design sketch: `docs/memory-design.md`
- Project context: `openspec/project.md`
- Existing memory skill: `~/.config/opencode/skills/memory/`
