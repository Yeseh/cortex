# Cortex MCP Server — Design Brainstorm

This document captures the design decisions from brainstorming sessions for the Cortex MCP server. It serves as input for creating formal OpenSpec change proposals.

## Overview

The MCP server exposes the Cortex memory system to AI agents via the Model Context Protocol. It is designed for remote access, running as a containerized service that agents can connect to over HTTP.

### Goals

- Expose Cortex memory operations via MCP (Tools + Resources)
- Remote-first: Streamable HTTP transport, Dockerized deployment
- Agent-friendly: Auto-create stores on first write, sensible defaults
- Zero config files: Fully configurable via environment variables
- Feature-based code organization mirroring CLI structure

### Non-Goals (v1)

- Authentication/authorization (deferred, trust network isolation)
- SSE or stdio transports (Streamable HTTP only)
- Prompts primitive (Tools + Resources only)

---

## Frontend Behavior Distinction

| Aspect                | CLI (Human-focused)                      | MCP Server (Agent-focused)    |
| --------------------- | ---------------------------------------- | ----------------------------- |
| **Store existence**   | Must exist, explicit `cortex store init` | Auto-create on first write    |
| **Category creation** | Auto-create on `add`                     | Auto-create on `add` (same)   |
| **Error handling**    | Strict, fail fast                        | More lenient, reduce friction |
| **Configuration**     | Layered config.yaml (global + local)     | Environment variables only    |

---

## Transport

**Streamable HTTP** at `/mcp` endpoint.

- Stateless, remote-friendly
- Single POST endpoint for MCP messages
- No session management required

---

## MCP Primitives

### Tools

| Tool Name        | Description                              | Parameters                                                            |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `add_memory`     | Create a new memory                      | `store?`, `path`, `content`, `tags?`, `expires_at?`                   |
| `get_memory`     | Retrieve a memory's content and metadata | `store?`, `path`, `include_expired?`                                  |
| `update_memory`  | Update memory content or metadata        | `store?`, `path`, `content?`, `tags?`, `expires_at?`, `clear_expiry?` |
| `remove_memory`  | Delete a memory                          | `store?`, `path`                                                      |
| `move_memory`    | Move/rename a memory                     | `store?`, `from_path`, `to_path`                                      |
| `list_memories`  | List memories in a category              | `store?`, `category?`, `include_expired?`                             |
| `prune_memories` | Delete all expired memories              | `store?`                                                              |
| `list_stores`    | List all stores in the data folder       | —                                                                     |
| `create_store`   | Explicitly create a new store            | `name`                                                                |

Note: `store` parameter is optional. When omitted, uses `CORTEX_DEFAULT_STORE` (default: `"default"`).

### Resources

| Resource URI Pattern             | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| `cortex://store/`                | List all stores                                       |
| `cortex://store/{name}`          | Store metadata and root category listing              |
| `cortex://memory/{store}/{path}` | Memory content (leaf) or category listing (directory) |

Examples:

- `cortex://memory/global/standards/typescript/eslint-config` — A specific memory
- `cortex://memory/project-x/decisions/` — List category contents
- `cortex://store/global` — Store info and root listing

---

## Store Model

- **Single data folder**: Server configured with `CORTEX_DATA_PATH` pointing to a root folder
- **Multiple stores**: Each store is a subdirectory within the data folder
- **Auto-creation**: Stores are created automatically on first write (agent-friendly)
- **Default store**: When `store` parameter omitted, uses `CORTEX_DEFAULT_STORE`

Directory structure:

```
/data/                          # CORTEX_DATA_PATH
├── default/                    # Default store
│   ├── config.yaml
│   ├── index.yaml
│   └── ...
├── project-x/                  # Named store
│   ├── config.yaml
│   ├── index.yaml
│   └── ...
└── team-knowledge/             # Another named store
    └── ...
```

---

## Configuration

All configuration via environment variables. No config.yaml dependency.

| Variable                        | Description                              | Default                                      | Notes                            |
| ------------------------------- | ---------------------------------------- | -------------------------------------------- | -------------------------------- |
| **Server settings**             |
| `CORTEX_DATA_PATH`              | Root folder for all stores               | `/data` (Docker) or `./.cortex-data` (local) | Required                         |
| `CORTEX_PORT`                   | HTTP server port                         | `3000`                                       |                                  |
| `CORTEX_HOST`                   | Bind address                             | `0.0.0.0`                                    |                                  |
| `CORTEX_DEFAULT_STORE`          | Store used when `store` param omitted    | `default`                                    |                                  |
| `CORTEX_LOG_LEVEL`              | Logging verbosity                        | `info`                                       | `debug`, `info`, `warn`, `error` |
| **Domain settings**             |
| `CORTEX_OUTPUT_FORMAT`          | Default output format                    | `yaml`                                       | `yaml` or `json`                 |
| `CORTEX_AUTO_SUMMARY_THRESHOLD` | Generate summary for memories > N tokens | `500`                                        | Integer >= 0                     |

Note: `strict_local` from CLI config is not applicable to MCP server (different operational model).

---

## Project Structure

Feature-based organization mirroring CLI structure:

```
src/
├── server/                      # MCP Server frontend
│   ├── index.ts                 # Entry point, Express setup
│   ├── mcp.ts                   # MCP server instance and transport setup
│   ├── health.ts                # Health check endpoint (/health)
│   ├── config.ts                # Environment variable parsing
│   ├── errors.ts                # Domain error -> MCP error translation
│   ├── memory/                  # Memory feature
│   │   ├── tools.ts             # add, get, update, remove, move, list, prune
│   │   ├── resources.ts         # cortex://memory/{store}/{path}
│   │   └── index.ts             # Register memory tools & resources
│   └── store/                   # Store feature
│       ├── tools.ts             # list_stores, create_store
│       ├── resources.ts         # cortex://store/{name}
│       └── index.ts             # Register store tools & resources
├── cli/                         # (existing) CLI frontend
│   ├── commands/
│   │   ├── store.ts
│   │   ├── add.ts
│   │   └── ...
├── core/                        # (existing) Shared foundations
├── memory/                      # (existing) Memory domain
├── store/                       # (existing) Store domain
├── index/                       # (existing) Indexing
└── storage/                     # (existing) Storage adapters
```

---

## Error Handling

Domain `Result<T, E>` errors are translated to MCP-specific error responses in `src/server/errors.ts`.

- Tools return MCP error format with appropriate error codes
- Resources return appropriate HTTP-style errors
- Validation errors (via Zod) are formatted consistently

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM oven/bun:1.3-alpine

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV CORTEX_DATA_PATH=/data
ENV CORTEX_PORT=3000

EXPOSE 3000
VOLUME ["/data"]

CMD ["bun", "run", "src/server/index.ts"]
```

### docker-compose.yaml

```yaml
services:
    cortex:
        build: .
        ports:
            - '${CORTEX_PORT:-3000}:3000'
        volumes:
            - cortex-data:/data
        environment:
            - CORTEX_DATA_PATH=/data
            - CORTEX_PORT=3000
            - CORTEX_DEFAULT_STORE=${CORTEX_DEFAULT_STORE:-default}
            - CORTEX_LOG_LEVEL=${CORTEX_LOG_LEVEL:-info}
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 5s

volumes:
    cortex-data:
```

### docker-compose.override.yaml (local dev, gitignored)

```yaml
services:
    cortex:
        volumes:
            - ./data:/data
        env_file:
            - .env
```

---

## Key Libraries

| Library                     | Purpose                                |
| --------------------------- | -------------------------------------- |
| `@modelcontextprotocol/sdk` | MCP server implementation              |
| `zod`                       | Input validation for tools             |
| `dotenv`                    | Local dev environment variable loading |

---

## Health Check

`GET /health` endpoint for container orchestration.

Returns:

```json
{
    "status": "healthy",
    "version": "1.0.0",
    "dataPath": "/data",
    "storeCount": 3
}
```

---

## Open Questions

_None remaining — ready for proposal formalization._

---

## References

- Memory system design: `.context/memory-brainstorm.md`
- Project context: `openspec/project.md`
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Microsoft MCP docs: https://learn.microsoft.com/en-us/azure/developer/ai/build-mcp-server-ts
