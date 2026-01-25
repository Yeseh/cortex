# Change: Add MCP Memory Tools

## Why

AI agents need CRUD operations on memories via MCP. Memory tools provide the primary interface for agents to create, read, update, and delete memories, as well as list and manage memory lifecycle.

## What Changes

- Add `add_memory` tool - create a new memory (auto-creates store on first write)
- Add `get_memory` tool - retrieve memory content and metadata
- Add `update_memory` tool - update memory content or metadata
- Add `remove_memory` tool - delete a memory
- Add `move_memory` tool - move/rename a memory
- Add `list_memories` tool - list memories in a category
- Add `prune_memories` tool - delete all expired memories
- Create `src/server/memory/tools.ts` with tool implementations
- Create `src/server/memory/index.ts` for registration

## Impact

- Affected specs: New `mcp-memory-tools` capability
- Affected code: `src/server/memory/`
- Dependencies: Requires `add-mcp-server-core` to be implemented first
- **Behavior difference from CLI**: Auto-creates stores on first write (agent-friendly)
