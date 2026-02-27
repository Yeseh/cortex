# @yeseh/cortex-server

MCP (Model Context Protocol) server for Cortex. This package enables AI agents to interact with the Cortex memory system through standardized tools and resources.

## Installation

```bash
bun add @yeseh/cortex-server
```

## Quick Start

```bash
# Start the MCP server
cortex-mcp

# Or with bun directly
bun run packages/server/src/index.ts
```

## Configuration

The server is configured via environment variables:

| Variable                | Description                                                | Default             |
| ----------------------- | ---------------------------------------------------------- | ------------------- |
| `CORTEX_DATA_PATH`      | Base Cortex data path (stores are under `<path>/memory`)  | `~/.config/cortex`  |
| `CORTEX_PORT`           | HTTP server port                                           | `3000`              |
| `CORTEX_HOST`           | HTTP bind host                                             | `0.0.0.0`           |
| `CORTEX_DEFAULT_STORE`  | Default store name                                         | `default`           |
| `CORTEX_LOG_LEVEL`      | Log verbosity (`debug`, `info`, `warn`, `error`)          | `info`              |
| `CORTEX_OUTPUT_FORMAT`  | Response output format (`yaml`, `json`, `toon`)           | `yaml`              |
| `CORTEX_CATEGORY_MODE`  | Default-store initialization mode (`free`, `subcategories`, `strict`) | `free` |

Compatibility aliases:

- `CORTEX_CONFIG_PATH` (alias for `CORTEX_DATA_PATH`)
- `CORTEX_STORE` (alias for `CORTEX_DEFAULT_STORE`)

## MCP Tools

The server exposes these tools for AI agents:

### Memory Tools

| Tool                         | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `cortex_add_memory`          | Create a new memory                           |
| `cortex_get_memory`          | Retrieve a memory by path                     |
| `cortex_update_memory`       | Update an existing memory                     |
| `cortex_remove_memory`       | Delete a memory                               |
| `cortex_move_memory`         | Move or rename a memory                       |
| `cortex_list_memories`       | List memories in a category                   |
| `cortex_prune_memories`      | Remove expired memories                       |
| `cortex_get_recent_memories` | Retrieve the N most recently updated memories |
| `cortex_reindex_store`       | Rebuild category indexes for a store          |

### Category Tools

| Tool                              | Description                    |
| --------------------------------- | ------------------------------ |
| `cortex_create_category`          | Create a new category          |
| `cortex_set_category_description` | Set category description       |
| `cortex_delete_category`          | Delete a category and contents |

### Store Tools

| Tool                  | Description                |
| --------------------- | -------------------------- |
| `cortex_list_stores`  | List all registered stores |
| `cortex_create_store` | Initialize a new store     |

## MCP Resources

The server provides these resources:

| Resource | URI Pattern                     | Description               |
| -------- | ------------------------------- | ------------------------- |
| Memory   | `cortex://store/path/to/memory` | Individual memory content |
| Category | `cortex://store/category/path`  | Category listing          |
| Store    | `cortex://stores`               | Store registry            |

## Integration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
    "mcpServers": {
        "cortex": {
            "command": "cortex-mcp",
            "env": {
                "CORTEX_DEFAULT_STORE": "my-store"
            }
        }
    }
}
```

### Programmatic Usage

```typescript
import { createServer } from '@yeseh/cortex-server';

const server = createServer({
    storeName: 'my-store',
});

// The server handles MCP protocol communication
await server.start();
```

## Tool Examples

### Adding a Memory

```json
{
    "tool": "cortex_add_memory",
    "arguments": {
        "store": "my-store",
        "path": "project/decisions/api-design",
        "content": "Use REST over GraphQL for simplicity",
        "tags": ["architecture", "api"]
    }
}
```

### Listing Memories

```json
{
    "tool": "cortex_list_memories",
    "arguments": {
        "store": "my-store",
        "category": "project/decisions"
    }
}
```

### Updating a Memory

```json
{
    "tool": "cortex_update_memory",
    "arguments": {
        "store": "my-store",
        "path": "project/decisions/api-design",
        "content": "Updated content here",
        "tags": ["architecture", "api", "updated"]
    }
}
```

## Health Check

The server exposes a health endpoint for monitoring:

```bash
curl http://localhost:3000/health
```

## Related Packages

- `@yeseh/cortex-core` - Core types and domain logic
- `@yeseh/cortex-storage-fs` - Filesystem storage adapter
- `@yeseh/cortex-cli` - Command-line interface

## License

MIT
