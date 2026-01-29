---
created_at: 2026-01-29T19:54:05.317Z
updated_at: 2026-01-29T19:54:05.317Z
tags:
  - git
  - commits
  - conventions
source: mcp
---
Cortex uses conventional commit format for all commits.

Format: `<type>(<scope>): <description>`

Common types used:
- feat: New features
- fix: Bug fixes
- refactor: Code restructuring without behavior change
- test: Test additions/modifications
- chore: Build/tooling changes
- docs: Documentation

Scope is typically the component (server, cli, core).