# Cortex

A hierarchical memory system for AI coding agents. Cortex provides persistent, structured storage that agents can use to maintain context across sessions.

## Installation

```bash
bun install
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

## Command Reference

### Global Commands

#### `cortex init`

Initialize global Cortex configuration.

```bash
cortex init [options]
```

| Flag      | Short | Description                              |
| --------- | ----- | ---------------------------------------- |
| `--force` | `-F`  | Overwrite existing configuration         |

### Memory Commands

All memory commands support the `--store` (`-s`) flag to specify a named store.

#### `cortex memory add <path>`

Create a new memory at the specified path.

```bash
cortex memory add <path> [options]
```

| Flag           | Short | Description                          |
| -------------- | ----- | ------------------------------------ |
| `--store`      | `-s`  | Use a named store                    |
| `--content`    | `-c`  | Memory content (inline)              |
| `--file`       | `-f`  | Read content from file               |
| `--tags`       | `-t`  | Comma-separated tags                 |
| `--expires-at` | `-e`  | Expiration date (ISO 8601)           |

**Examples:**

```bash
# Add with inline content
cortex memory add project/decisions/api-design -c "REST over GraphQL for simplicity"

# Add with tags
cortex memory add bugs/issue-123 -c "Null pointer in parser" -t "bug,critical"

# Add from file
cortex memory add docs/readme -f ./README.md

# Add with expiration
cortex memory add temp/session-notes -c "Review tomorrow" -e "2024-12-31"
```

#### `cortex memory show <path>`

Display a memory's content and metadata.

```bash
cortex memory show <path> [options]
```

| Flag               | Short | Description                          |
| ------------------ | ----- | ------------------------------------ |
| `--store`          | `-s`  | Use a named store                    |
| `--include-expired`| `-x`  | Include expired memories             |
| `--format`         | `-o`  | Output format (text, json)           |

#### `cortex memory update <path>`

Update an existing memory.

```bash
cortex memory update <path> [options]
```

| Flag            | Short | Description                          |
| --------------- | ----- | ------------------------------------ |
| `--store`       | `-s`  | Use a named store                    |
| `--content`     | `-c`  | New memory content                   |
| `--file`        | `-f`  | Read content from file               |
| `--tags`        | `-t`  | Replace tags (comma-separated)       |
| `--expires-at`  | `-e`  | Set expiration date (ISO 8601)       |
| `--clear-expiry`| `-E`  | Remove expiration date               |

#### `cortex memory remove <path>`

Delete a memory.

```bash
cortex memory remove <path> [options]
```

| Flag      | Short | Description                          |
| --------- | ----- | ------------------------------------ |
| `--store` | `-s`  | Use a named store                    |

#### `cortex memory move <from> <to>`

Move or rename a memory.

```bash
cortex memory move <from> <to> [options]
```

| Flag      | Short | Description                          |
| --------- | ----- | ------------------------------------ |
| `--store` | `-s`  | Use a named store                    |

**Example:**

```bash
cortex memory move drafts/idea project/decisions/idea
```

#### `cortex memory list [category]`

List memories in a category.

```bash
cortex memory list [category] [options]
```

| Flag               | Short | Description                          |
| ------------------ | ----- | ------------------------------------ |
| `--store`          | `-s`  | Use a named store                    |
| `--include-expired`| `-x`  | Include expired memories             |
| `--format`         | `-o`  | Output format (text, json)           |

**Examples:**

```bash
# List all memories in a category
cortex memory list project/decisions

# List with JSON output
cortex memory list project -o json

# Include expired memories
cortex memory list archive -x
```

### Store Commands

#### `cortex store list`

List all registered stores.

```bash
cortex store list
```

#### `cortex store add <name> <path>`

Register an existing store directory.

```bash
cortex store add <name> <path>
```

**Example:**

```bash
cortex store add my-project /path/to/project/.cortex
```

#### `cortex store remove <name>`

Unregister a store (does not delete files).

```bash
cortex store remove <name>
```

#### `cortex store init [path]`

Initialize a new store at the specified path.

```bash
cortex store init [path] [options]
```

| Flag     | Short | Description                              |
| -------- | ----- | ---------------------------------------- |
| `--name` | `-n`  | Register with this name after creation   |

**Examples:**

```bash
# Initialize in current directory
cortex store init

# Initialize at specific path and register
cortex store init ./project/.cortex -n my-project
```

#### `cortex store prune`

Remove expired memories from a store.

```bash
cortex store prune [options]
```

| Flag      | Short | Description                          |
| --------- | ----- | ------------------------------------ |
| `--store` | `-s`  | Target store (default: resolved)     |

#### `cortex store reindex`

Rebuild the store's search index.

```bash
cortex store reindex [options]
```

| Flag      | Short | Description                          |
| --------- | ----- | ------------------------------------ |
| `--store` | `-s`  | Target store (default: resolved)     |

## Store Resolution

When you run a command, Cortex resolves which store to use in this order:

1. **Explicit**: `--store <name>` flag specifies a registered store by name
2. **Local**: `.cortex/memory` directory in current working directory
3. **Global**: `~/.config/cortex/memory` (the default store)

This allows project-specific memories when working in a directory with a local `.cortex` folder, while falling back to global storage otherwise.

## Common Workflows

### Project-Specific Memory

```bash
# Initialize a store in your project
cd my-project
cortex store init .cortex -n my-project

# Add project memories (uses local store automatically)
cortex memory add decisions/database -c "PostgreSQL for ACID compliance"
cortex memory add standards/naming -c "camelCase for variables, PascalCase for types"
```

### Organizing with Categories

```bash
# Create a hierarchy of memories
cortex memory add project/backend/api/auth -c "JWT with refresh tokens"
cortex memory add project/backend/api/rate-limiting -c "100 req/min per user"
cortex memory add project/frontend/state -c "Zustand for global state"

# List by category
cortex memory list project/backend/api
```

### Temporary Memories with Expiration

```bash
# Create a memory that expires
cortex memory add temp/meeting-notes -c "Discuss API changes" -e "2024-12-15"

# Later, clean up expired memories
cortex store prune
```

### Tagging for Cross-Cutting Concerns

```bash
# Add memories with tags
cortex memory add decisions/caching -c "Redis for session storage" -t "performance,infrastructure"
cortex memory add decisions/cdn -c "CloudFront for static assets" -t "performance,infrastructure"
```

## Development

```bash
# Run the CLI
bun run index.ts

# Run tests
bun test

# Run integration tests
bun test tests/integration/cli.integration.spec.ts
```

## License

MIT
