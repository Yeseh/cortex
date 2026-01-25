# Change: Add MCP Docker Deployment

## Why

The MCP server is designed for remote-first operation. Docker containerization enables easy deployment, scaling, and integration with container orchestration systems.

## What Changes

- Add `Dockerfile` using `oven/bun:1.3-alpine` base image
- Add `docker-compose.yaml` for production deployment
- Add `docker-compose.override.yaml.example` for local development template
- Document deployment configuration and volume management

## Impact

- Affected specs: New `mcp-docker-deployment` capability
- Affected code: Project root (`Dockerfile`, `docker-compose.yaml`)
- Dependencies: Requires `add-mcp-server-core` to be implemented first
