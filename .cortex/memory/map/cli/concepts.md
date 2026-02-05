---
created_at: 2026-02-05T19:16:02.058Z
updated_at: 2026-02-05T19:16:02.058Z
tags:
  - map
  - cli
  - concepts
  - commands
source: mcp
---
# CLI Package Key Concepts

## Command Hierarchy
- `cortex init` - Initialize global config
- `cortex memory <cmd>` - Memory operations (add, show, list, update, remove, move)
- `cortex store <cmd>` - Store management (list, add, remove, init, prune, reindex)

## Store Resolution Order
1. Explicit: `--store <name>` flag
2. Local: `.cortex/memory` in current directory
3. Global: `~/.config/cortex/memory`

## Output Formats
- yaml (default) - Human-readable
- json - Machine-readable
- toon - Token-Oriented Object Notation for LLM context

## Error Categories
- InvalidArgumentError - User input errors (shows usage help)
- CommanderError - System errors (shows error only)

## Command Handler Pattern
1. Define options interface
2. Define handler dependencies (for testability)
3. Implement handler function (exported for testing)
4. Define Commander command with action

## Input Sources
- `--content` flag - Direct content
- `--file` flag - Read from file
- stdin - Pipe content