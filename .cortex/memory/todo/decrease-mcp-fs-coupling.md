---
created_at: 2026-02-14T17:59:14.018Z
updated_at: 2026-02-14T17:59:14.018Z
tags: []
source: mcp
citations:
  - openspec/project.md
---
Title: Decrease MCP server coupling on FS backend
Why: The MCP (server) currently depends on filesystem-specific behaviors in storage-fs; decoupling will allow alternative storage adapters and easier testing.
Goal: Implement an adaptation layer and update the server to depend on core storage ports rather than fs-specific implementations.
Tasks:
- Inventory: identify server areas that call storage-fs internals directly
- Define Adapter: create an adapter interface in core that encapsulates filesystem specifics
- Implement Adapter: add an adapter in storage-fs that implements the new interface
- Refactor MCP server: update server to use the new interface and remove fs-specific calls
- Tests: add integration tests using a mock adapter and an in-memory adapter
- Docs & Migration: document changes and provide migration steps for existing deployments
Risks & Notes:
- Keep behavior parity; avoid introducing latency regression
- Coordinate release with storage-fs and server packages
Tags: [server, storage-fs, todo]