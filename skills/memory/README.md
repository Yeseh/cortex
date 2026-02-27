# Memory Skill

A persistent memory management skill for AI coding agents using the Cortex MCP tools.

## Overview

This skill provides a standardized interface for managing persistent memory using the Cortex MCP server. Memories are organized into:

- **Stores**: Top-level containers (default store is `memory`)
- **Categories**: Nested folders that group related knowledge
- **Memories**: Atomic markdown entries with metadata

**Important:** The store name is not part of the memory path. Use `store` separately (or omit it to use the default). See [skills/memory/references/concepts.md](skills/memory/references/concepts.md).

## Architecture

```
memory/
├── SKILL.md                    # Agent-readable skill instructions
├── README.md                   # This file (human documentation)
└── references/                 # Concepts and guidance
    ├── concepts.md
    ├── hierarchy.md
    ├── loading.md
    ├── practices.md
    ├── schema.md
    ├── tools.md
    └── workflows.md
```

## Key Concepts

### Store vs Category vs Memory

- **Store**: A top-level container (default `memory`)
- **Category**: A folder path within a store (e.g., `projects/cortex/architecture`)
- **Memory**: A single markdown entry with metadata

**Correct path format:** `human/profile/identity`  
**Incorrect path format:** `memory/human/profile/identity`

Details: [skills/memory/references/concepts.md](skills/memory/references/concepts.md).

## Category Hierarchy

Use nested categories and keep paths meaningful:

```
memory/                           # Store (container)
├── human/                        # User identity & preferences
│   ├── profile/
│   │   └── identity.md
│   └── preferences/
│       ├── coding.md
│       └── communication.md
├── persona/                      # Agent behavior configuration
│   ├── tone.md
│   └── expertise.md
└── projects/                     # Project-specific knowledge
    └── cortex/
        ├── architecture/
        │   └── patterns.md
        └── testing/
            └── policy.md
```

Standard root categories and anti-patterns are documented in [skills/memory/references/hierarchy.md](skills/memory/references/hierarchy.md).

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

Full reference: [skills/memory/references/tools.md](skills/memory/references/tools.md).

## Loading Strategy

Do not load everything. Use progressive discovery:

1. List top-level categories: `cortex_list_memories()`
2. Drill into relevant categories
3. Load specific memories with `cortex_get_memory`

Details: [skills/memory/references/loading.md](skills/memory/references/loading.md).

## Common Workflows

Examples include session initialization, recording preferences, and migration:

- [skills/memory/references/workflows.md](skills/memory/references/workflows.md)

## Best Practices

- Use nested categories
- Keep memories atomic
- Use consistent tags
- Update, don’t duplicate
- Prune expired entries

Details: [skills/memory/references/practices.md](skills/memory/references/practices.md).

## Human Profile Schema

The `human/profile/identity` memory should follow this schema:

```
- Full name: [User's complete name]
- Region: [NL/BE/DE/PL/CH/US/Other]
- Role: [Consultant/Sales/HR/Leadership/Other]
- Handle: [lowercase-identifier]
```

Schema details: [skills/memory/references/schema.md](skills/memory/references/schema.md).
