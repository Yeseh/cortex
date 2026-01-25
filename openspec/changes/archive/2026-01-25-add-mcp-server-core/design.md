# Design: MCP Server Core Infrastructure

## Context

The Cortex memory system currently only supports CLI access. AI agents require remote, programmatic access via the Model Context Protocol (MCP). This design covers the foundational server infrastructure.

## Goals / Non-Goals

### Goals

- Stateless HTTP transport for remote agent access
- Environment-only configuration (no config files)
- Clean separation between transport layer and domain logic
- Container-ready with health checks

### Non-Goals

- Authentication/authorization (deferred, trust network isolation)
- SSE or stdio transports (Streamable HTTP only)
- Prompts primitive (Tools + Resources only)

## Decisions

### Transport: Streamable HTTP

**Decision**: Use Streamable HTTP transport at `/mcp` endpoint.

**Rationale**:

- Stateless, remote-friendly
- Single POST endpoint for MCP messages
- No session management required
- Works well with container orchestration

**Alternatives considered**:

- SSE: Requires persistent connections, complex for containers
- stdio: Local only, not suitable for remote access

### Configuration: Environment Variables Only

**Decision**: All configuration via environment variables, no config.yaml.

**Rationale**:

- Standard for containerized services
- 12-factor app compliance
- Simpler operational model for remote deployment

**Variables**:
| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_DATA_PATH` | `/data` (Docker) or `./.cortex-data` (local) | Root folder for stores |
| `CORTEX_PORT` | `3000` | HTTP server port |
| `CORTEX_HOST` | `0.0.0.0` | Bind address |
| `CORTEX_DEFAULT_STORE` | `default` | Store when param omitted |
| `CORTEX_LOG_LEVEL` | `info` | Logging verbosity |
| `CORTEX_OUTPUT_FORMAT` | `yaml` | Default output format |
| `CORTEX_AUTO_SUMMARY_THRESHOLD` | `500` | Summary generation threshold |

### Error Translation

**Decision**: Centralized error translation in `src/server/errors.ts`.

**Rationale**:

- Domain `Result<T, E>` errors mapped to MCP error format
- Consistent error codes across all tools
- Zod validation errors formatted uniformly

### Health Check

**Decision**: Simple `/health` GET endpoint returning JSON.

**Response format**:

```json
{
    "status": "healthy",
    "version": "1.0.0",
    "dataPath": "/data",
    "storeCount": 3
}
```

## Directory Structure

```
src/server/
├── index.ts      # Entry point, Express setup
├── mcp.ts        # MCP server instance and transport
├── health.ts     # Health check endpoint
├── config.ts     # Environment variable parsing
├── errors.ts     # Domain error → MCP error translation
├── memory/       # (future: memory tools & resources)
└── store/        # (future: store tools & resources)
```

## Risks / Trade-offs

| Risk                                | Mitigation                             |
| ----------------------------------- | -------------------------------------- |
| No auth exposes memory data         | Document network isolation requirement |
| Single transport limits flexibility | Can add transports later if needed     |
| Env-only config less discoverable   | Provide clear documentation            |

## Open Questions

None - design is complete.
