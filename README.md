<div align="center">
  <img src="assets/logo.svg" alt="Current Logo" width="200" />
  <p>
    <strong>
      A hierarchical memory system for AI coding agents 
    </strong>
  </p>
</div>

# About

> ⚠️ **Heads up:** this project is experimental and under active development. No guarantees it will work as expected.

A hierarchical memory system for AI coding agents. Cortex provides persistent, structured storage that agents can use to maintain context across sessions.

## Packages

This is a monorepo containing the following packages:

| Package                                             | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| [`@yeseh/cortex-core`](./packages/core)             | Core domain logic, types, and validation |
| [`@yeseh/cortex-storage-fs`](./packages/storage-fs) | Filesystem storage adapter               |
| [`@yeseh/cortex-cli`](./packages/cli)               | Command-line interface                   |
| [`@yeseh/cortex-server`](./packages/server)         | MCP server for AI agent integration      |

## Quick Start

```bash
# Install dependencies
bun install

# Initialize global configuration
bun run packages/cli/src/run.ts init

# Add a memory
bun run packages/cli/src/run.ts memory add project/notes/architecture -c "Use event sourcing"

# List memories
bun run packages/cli/src/run.ts memory list project/notes
```

## Installation

### CLI

```bash
# Global installation
bun add -g @yeseh/cortex-cli

# Then use directly
cortex memory add project/notes -c "Content here"
```

### MCP Server

Add to your Claude Desktop config:

```json
{
    "mcpServers": {
        "cortex": {
            "command": "cortex-mcp"
        }
    }
}
```

### As a Library

```bash
bun add @yeseh/cortex-core @yeseh/cortex-storage-fs
```

```typescript
import { createMemory, validateMemorySlugPath } from '@yeseh/cortex-core/memory';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

const adapter = new FilesystemStorageAdapter({ rootDirectory: '.cortex' });
const memory = createMemory('My content', { tags: ['example'] });
await adapter.writeMemory('notes/example', memory.value);
```

## CLI Commands

### Memory Commands

```bash
cortex memory add <path> -c "content"    # Create a memory
cortex memory show <path>                 # Display a memory
cortex memory update <path> -c "new"      # Update a memory
cortex memory remove <path>               # Delete a memory
cortex memory move <from> <to>            # Move/rename a memory
cortex memory list [category]             # List memories
```

### Store Commands

```bash
cortex store list                         # List registered stores
cortex store add <name> <path>            # Register a store
cortex store remove <name>                # Unregister a store
cortex store init [path]                  # Initialize a new store
cortex store prune                        # Remove expired memories
cortex store reindex                      # Rebuild indexes
```

## Store Resolution

Cortex resolves which store to use in this order:

1. **Explicit**: `--store <name>` flag
2. **Local**: `.cortex/memory` in current directory
3. **Global**: `~/.config/cortex/memory`

## Configuration

Cortex uses a YAML configuration file at `~/.config/cortex/config.yaml`:

```yaml
settings:
  outputFormat: yaml  # Output format: yaml, json, or toon
  autoSummaryThreshold: 0
  strictLocal: false

stores:
  default:
    path: /home/user/.config/cortex/memory
    description: Global user memory store
    categoryMode: subcategories  # free, subcategories, or strict
    categories:
      human:
        description: User identity and preferences
        subcategories:
          profile:
            description: User profile information
          preferences:
            description: Coding style and workflow preferences
      standards:
        description: Coding standards and architecture decisions
```

### Category Modes

Control how categories can be created and deleted:

| Mode | Description |
|------|-------------|
| `free` | Categories can be created/deleted freely (default) |
| `subcategories` | Only subcategories of config-defined root categories allowed |
| `strict` | Only config-defined categories allowed, no runtime creation |

### Category Hierarchy

Define protected category structures in your config. Each category supports:

- `description`: Optional description (max 500 characters)
- `subcategories`: Nested category definitions

Categories defined in config are protected from deletion. In `subcategories` mode, new categories can be created under config-defined roots. In `strict` mode, only explicitly defined categories are allowed.

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run tests for a specific package
bun test packages/core
bun test packages/cli
bun test packages/server
bun test packages/storage-fs

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build
```

### Project Structure

```
cortex/
├── packages/
│   ├── core/           # @yeseh/cortex-core
│   │   └── src/
│   │       ├── memory/     # Memory types and operations
│   │       ├── category/   # Category and index management
│   │       ├── store/      # Store registry
│   │       ├── storage/    # Storage port interfaces
│   │       └── validation/ # Input validation utilities
│   ├── storage-fs/     # @yeseh/cortex-storage-fs
│   │   └── src/
│   │       ├── index.ts    # FilesystemStorageAdapter
│   │       └── ...         # Filesystem operations
│   ├── cli/            # @yeseh/cortex-cli
│   │   └── src/
│   │       ├── commands/   # CLI commands
│   │       └── run.ts      # Entry point
│   └── server/         # @yeseh/cortex-server
│       └── src/
│           ├── memory/     # Memory MCP tools
│           ├── category/   # Category MCP tools
│           ├── store/      # Store MCP tools
│           └── index.ts    # MCP server entry
├── openspec/           # Specifications and change proposals
├── package.json        # Workspace root
└── tsconfig.base.json  # Shared TypeScript config
```

## License

MIT
