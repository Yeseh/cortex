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

Cortex gives AI coding agents persistent, structured memory across sessions. Agents read and write named memories organized into stores and categories — so context survives between conversations, projects, and machines.

## Packages

This is a monorepo containing the following packages:

| Package                                             | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| [`@yeseh/cortex-core`](./packages/core)             | Core domain logic, types, and validation |
| [`@yeseh/cortex-storage-fs`](./packages/storage-fs) | Filesystem storage adapter               |
| [`@yeseh/cortex-cli`](./packages/cli)               | Command-line interface                   |
| [`@yeseh/cortex-server`](./packages/server)         | MCP server for AI agent integration      |

## Install from GitHub Packages

Cortex packages are published to GitHub Packages under the `@yeseh` scope.

### 1) Configure registry and auth

Add this to your user-level `.npmrc` (recommended) or project `.npmrc`:

```ini
@yeseh:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then set `GITHUB_TOKEN` to a token that can read packages from the `yeseh` org/user.

```bash
export GITHUB_TOKEN=YOUR_GITHUB_TOKEN
```

### 2) Install packages

```bash
# Optional: MCP server package
bun add @yeseh/cortex-server

# Core library + filesystem adapter
bun add @yeseh/cortex-core @yeseh/cortex-storage-fs

# Optional: CLI package
bun add @yeseh/cortex-cli

```

## MCP Server Setup

The primary way to use Cortex is as an MCP server. Once connected, AI agents can call Cortex tools to read, write, and organize memories.

### Build the binary

```bash
git clone https://github.com/yeseh/cortex.git
cd cortex
bun install
bun run compile:mcp     # outputs ./bin/cortex-mcp
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
    "mcpServers": {
        "cortex": {
            "command": "/path/to/bin/cortex-mcp"
        }
    }
}
```

### OpenCode

Add to your `opencode.json`:

```json
{
    "mcp": {
        "cortex": {
            "type": "stdio",
            "command": "/path/to/bin/cortex-mcp"
        }
    }
}
```

### MCP Tools

Once connected, agents have access to the following tools:

| Tool                              | Description                                   |
| --------------------------------- | --------------------------------------------- |
| `cortex_add_memory`               | Create a new memory                           |
| `cortex_get_memory`               | Retrieve memory content and metadata          |
| `cortex_update_memory`            | Update memory content or metadata             |
| `cortex_remove_memory`            | Delete a memory                               |
| `cortex_move_memory`              | Move or rename a memory                       |
| `cortex_list_memories`            | List memories in a category                   |
| `cortex_get_recent_memories`      | Retrieve the N most recently updated memories |
| `cortex_prune_memories`           | Delete all expired memories                   |
| `cortex_list_stores`              | List all available memory stores              |
| `cortex_create_store`             | Create a new memory store                     |
| `cortex_reindex_store`            | Rebuild category indexes for a store          |
| `cortex_create_category`          | Create a category and its parent hierarchy    |
| `cortex_delete_category`          | Delete a category and all its contents        |
| `cortex_set_category_description` | Set or clear a category description           |

## CLI

The CLI is for manual memory management — inspecting, editing, or scripting memory operations outside of an agent session.

### Build the binary

```bash
bun run compile:cli     # outputs ./bin/cortex
```

### Initialize

```bash
# Initialize global configuration (~/.config/cortex)
cortex init
```

### Memory Commands

```bash
cortex memory add <path> -c "content"    # Create a memory
cortex memory show <path>                # Display a memory
cortex memory update <path> -c "new"     # Update a memory
cortex memory remove <path>              # Delete a memory
cortex memory move <from> <to>           # Move/rename a memory
cortex memory list [category]            # List memories
```

### Store Commands

```bash
cortex store list                        # List registered stores
cortex store add <name> <path>           # Register a store
cortex store remove <name>               # Unregister a store
cortex store init [path]                 # Initialize a new store
cortex store prune                       # Remove expired memories
cortex store reindex                     # Rebuild indexes
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
    outputFormat: yaml # Output format: yaml, json, or toon

stores:
    default:
        path: /home/user/.config/cortex/memory
        description: Global user memory store
        categoryMode: free # free, subcategories, or strict
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

| Mode            | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `free`          | Categories can be created/deleted freely (default)           |
| `subcategories` | Only subcategories of config-defined root categories allowed |
| `strict`        | Only config-defined categories allowed, no runtime creation  |

### Category Hierarchy

Define protected category structures in your config. Each category supports:

- `description`: Optional description (max 500 characters)
- `subcategories`: Nested category definitions

Categories defined in config are protected from deletion. In `subcategories` mode, new categories can be created under config-defined roots. In `strict` mode, only explicitly defined categories are allowed.

## As a Library

Core types and operations are available for embedding in your own tools. Note that the library API is low-level — this is the same layer used internally by the CLI and MCP server.

```bash
bun add @yeseh/cortex-core @yeseh/cortex-storage-fs
```

```typescript
import { join } from 'node:path';
import { Cortex } from '@yeseh/cortex-core';
import { FilesystemStorageAdapter, FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';

const cortex = Cortex.init({
    adapterFactory: (storeName) => {
        const storeRoot = join('.cortex', storeName);
        return new FilesystemStorageAdapter(
            new FilesystemConfigAdapter(join(storeRoot, '.config.yaml')),
            { rootDirectory: storeRoot }
        );
    },
});

const storeResult = cortex.getStore('my-store');
if (storeResult.ok()) {
    const memory = storeResult.value.getMemory('notes/example');
    const result = await memory.create({
        content: 'My content',
        source: 'user',
        tags: ['example'],
    });
    if (result.ok()) {
        console.log('Created:', result.value.path.toString());
    }
}
```

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test packages

# Run tests for a specific package
bun test packages/core
bun test packages/cli
bun test packages/server
bun test packages/storage-fs

# Type check
bun run typecheck

# Lint
bun run lint

# Build all packages
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
│   │       └── config/     # Configuration parsing
│   ├── storage-fs/     # @yeseh/cortex-storage-fs
│   │   └── src/
│   │       └── ...         # Filesystem storage adapter
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
