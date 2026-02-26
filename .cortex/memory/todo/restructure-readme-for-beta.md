---
created_at: 2026-02-26T20:01:24.862Z
updated_at: 2026-02-26T20:01:24.862Z
tags: 
  - todo
  - documentation
  - readme
  - beta
  - medium-priority
source: mcp
---
# TODO: Restructure README for MCP-First Audience

## Priority
Medium — important for beta but not a blocker

## Summary
Reorder README to lead with MCP server setup since that's the primary use case for beta testers (colleagues using AI coding agents). Current structure leads with CLI quick-start which is a dev workflow.

## Proposed Structure
1. What is Cortex (brief)
2. MCP Server setup (Claude Desktop / OpenCode config)
3. Skills installation (copy `skills/` directory into `~/.config/opencode/skills/`)
4. CLI (secondary, for manual memory management)
5. Development (for contributors)

## Also Fix
- Remove references to unimplemented `autoSummaryThreshold` and `strictLocal` config options
- Remove category modes documentation (`free`/`subcategories`/`strict`) — feature deferred to post-1.0
- Fix "As a Library" code example (API changed: `writeMemory` → `save`)
- Clarify installation for beta testers (packages not on npm yet, need build-from-source or binary instructions)