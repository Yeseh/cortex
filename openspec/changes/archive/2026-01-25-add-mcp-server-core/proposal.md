# Change: Add MCP Server Core Infrastructure

## Why

AI agents need remote access to Cortex memory operations via the Model Context Protocol (MCP). This proposal establishes the foundational server infrastructure that all MCP features will build upon, including HTTP transport, configuration management, health monitoring, and error translation.

## What Changes

- Add Express-based HTTP server with Streamable HTTP transport at `/mcp` endpoint
- Add MCP server instance setup using `@modelcontextprotocol/sdk`
- Add environment-based configuration system (no config.yaml dependency)
- Add `/health` endpoint for container orchestration
- Add domain error to MCP error translation layer
- Create `src/server/` directory structure

## Impact

- Affected specs: New `mcp-server-core` capability
- Affected code: New `src/server/` directory
- Dependencies: `@modelcontextprotocol/sdk`, `zod`, `dotenv`
- This is a **foundation change** - other MCP proposals depend on this
