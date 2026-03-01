# Memory Skill

A persistent memory management skill for AI coding agents using the Cortex MCP tools.

## Overview

This skill provides a standardized interface for managing persistent memory using the Cortex MCP server. Memories are organized into:

- **Stores**: Top-level containers (default store is `default`)
- **Categories**: Nested folders that group related knowledge
- **Memories**: Atomic markdown entries with metadata

**Important:** The store name is not part of the memory path. Use `store` separately. See [skills/memory/references/fundamentals.md](skills/memory/references/fundamentals.md).

## Architecture

```
memory/
├── SKILL.md                    # Agent-readable skill instructions
├── README.md                   # This file (human documentation)
└── references/
    ├── fundamentals.md         # Rules, structure, loading, expiry, identity schema
    ├── operations.md           # MCP operation cheat sheet
    ├── workflows.md            # Workflow index
    └── workflows/              # One file per workflow playbook
        ├── session-start.md
        ├── new-project-init.md
        ├── capture-knowledge.md
        ├── synthesize-facts.md
        ├── review-hygiene.md
        └── session-end-cleanup.md
```

## Key Rules

- Always set `store` explicitly.
- Keep memories atomic (one fact/decision per memory).
- Load selectively (list → drill down → fetch specific memory).
- Set expiry for temporary context.
- Never store sensitive data.

See [skills/memory/references/fundamentals.md](skills/memory/references/fundamentals.md).

## MCP Tools

The Cortex MCP server exposes these tools:

### Memory operations
- `cortex_add_memory`
- `cortex_get_memory`
- `cortex_update_memory`
- `cortex_remove_memory`
- `cortex_move_memory`
- `cortex_list_memories`
- `cortex_prune_memories`

### Store operations
- `cortex_list_stores`
- `cortex_create_store`

### Category operations
- `cortex_create_category`
- `cortex_set_category_description`
- `cortex_delete_category`

### Read-only resources
- `cortex://store/`
- `cortex://store/{name}`
- `cortex://memory/{path}`

Full reference: [skills/memory/references/operations.md](skills/memory/references/operations.md).

## Common Workflows

Examples include session startup, synthesizing facts, hygiene review, and project initialization after Cortex setup:

- [skills/memory/references/workflows.md](skills/memory/references/workflows.md)

## Fundamentals Reference

Store selection, loading strategy, expiration policy, and human identity schema:

- [skills/memory/references/fundamentals.md](skills/memory/references/fundamentals.md)
