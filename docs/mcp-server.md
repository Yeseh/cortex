# MCP Server Guide

The Cortex MCP server exposes memory tools over HTTP so AI agents can read and write persistent memory.

## Install

```bash
npm install -g @yeseh/cortex-server
```

## Build from Source

```bash
git clone https://github.com/yeseh/cortex.git
cd cortex
bun install
bun run compile:mcp     # outputs ./bin/cortex-mcp
```

## Start the Server

```bash
# Default: listens on http://0.0.0.0:3000
./bin/cortex-mcp

# Custom port / host
CORTEX_PORT=8080 CORTEX_HOST=127.0.0.1 ./bin/cortex-mcp
```

Endpoints:

- `POST /mcp` — MCP protocol endpoint
- `GET /health` — health check

## Client Configuration Examples

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\\Claude\\claude_desktop_config.json` (Windows):

```json
{
    "mcpServers": {
        "cortex": {
            "type": "http",
            "url": "http://localhost:3000/mcp"
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
            "type": "http",
            "url": "http://localhost:3000/mcp"
        }
    }
}
```

## MCP Tools

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

## Related

- [Configuration Reference](./configuration.md)
- [Agent Instructions](./agent-instructions.md)
