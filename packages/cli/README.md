# @yeseh/cortex-cli

Command-line interface for the Cortex memory system. Manage memories, categories, and stores from your terminal.

## Installation

```bash
bun add -g @yeseh/cortex-cli
```

Or run directly with bun:

```bash
bunx @yeseh/cortex-cli memory list
```

## Quick Start

```bash
# Initialize global configuration
cortex init

# Add a memory
cortex memory add project/notes/architecture -c "Use event sourcing for state management"

# List memories in a category
cortex memory list project/notes

# Show a specific memory
cortex memory show project/notes/architecture

# Update a memory
cortex memory update project/notes/architecture -c "Updated content here"

# Remove a memory
cortex memory remove project/notes/architecture
```

## Commands

### Global

| Command | Description |
|---------|-------------|
| `cortex init` | Initialize global Cortex configuration |

### Memory Commands

| Command | Description |
|---------|-------------|
| `cortex memory add <path>` | Create a new memory |
| `cortex memory show <path>` | Display a memory |
| `cortex memory update <path>` | Update an existing memory |
| `cortex memory remove <path>` | Delete a memory |
| `cortex memory move <from> <to>` | Move or rename a memory |
| `cortex memory list [category]` | List memories in a category |

### Store Commands

| Command | Description |
|---------|-------------|
| `cortex store list` | List all registered stores |
| `cortex store add <name> <path>` | Register an existing store |
| `cortex store remove <name>` | Unregister a store |
| `cortex store init [path]` | Initialize a new store |
| `cortex store prune` | Remove expired memories |
| `cortex store reindex` | Rebuild the store index |

## Common Options

Most commands support these flags:

| Flag | Short | Description |
|------|-------|-------------|
| `--store` | `-s` | Use a specific named store |
| `--format` | `-o` | Output format (yaml, json, toon) |
| `--include-expired` | `-x` | Include expired memories |

## Store Resolution

When you run a command, Cortex resolves which store to use:

1. **Explicit**: `--store <name>` flag specifies a registered store
2. **Local**: `.cortex/memory` directory in current working directory
3. **Global**: `~/.config/cortex/memory` (the default store)

This allows project-specific memories when working in a directory with a local `.cortex` folder.

## Examples

### Project-Specific Memory

```bash
# Initialize a store in your project
cd my-project
cortex store init .cortex -n my-project

# Add project memories (uses local store automatically)
cortex memory add decisions/database -c "PostgreSQL for ACID compliance"
```

### Organizing with Categories

```bash
# Create a hierarchy
cortex memory add project/backend/api/auth -c "JWT with refresh tokens"
cortex memory add project/backend/api/rate-limiting -c "100 req/min per user"

# List by category
cortex memory list project/backend/api
```

### Temporary Memories with Expiration

```bash
# Create a memory that expires
cortex memory add temp/meeting-notes -c "Discuss API changes" -e "2024-12-15"

# Clean up expired memories
cortex store prune
```

### Output Formats

```bash
# YAML output (default)
cortex memory list project

# JSON output
cortex memory list project -o json

# TOON output (compact)
cortex memory list project -o toon
```

## Related Packages

- `@yeseh/cortex-core` - Core types and domain logic
- `@yeseh/cortex-storage-fs` - Filesystem storage adapter
- `@yeseh/cortex-server` - MCP server for AI agent integration

## License

MIT
