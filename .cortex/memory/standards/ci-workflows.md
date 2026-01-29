---
created_at: 2026-01-29T19:54:02.828Z
updated_at: 2026-01-29T19:54:02.828Z
tags:
  - ci
  - github-actions
  - workflows
  - testing
source: mcp
---
GitHub workflows are separated by component with path-based triggers.

Workflows:
- `.github/workflows/core.yml` - Core library (src/core/**)
- `.github/workflows/cli.yml` - CLI tool (src/cli/**)
- `.github/workflows/mcp-server.yml` - MCP server (src/server/**)

Each workflow runs: lint, typecheck, test, build (in dependency order).
Artifacts are uploaded for CLI and MCP server binaries.