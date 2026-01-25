# Tasks: Add MCP Memory Tools

## 1. Tool Implementation

- [ ] 1.1 Create `src/server/memory/tools.ts` with tool definitions
- [ ] 1.2 Implement `add_memory` tool with parameters: `store?`, `path`, `content`, `tags?`, `expires_at?`
- [ ] 1.3 Implement `get_memory` tool with parameters: `store?`, `path`, `include_expired?`
- [ ] 1.4 Implement `update_memory` tool with parameters: `store?`, `path`, `content?`, `tags?`, `expires_at?`, `clear_expiry?`
- [ ] 1.5 Implement `remove_memory` tool with parameters: `store?`, `path`
- [ ] 1.6 Implement `move_memory` tool with parameters: `store?`, `from_path`, `to_path`
- [ ] 1.7 Implement `list_memories` tool with parameters: `store?`, `category?`, `include_expired?`
- [ ] 1.8 Implement `prune_memories` tool with parameters: `store?`

## 2. Auto-Creation Behavior

- [ ] 2.1 Implement auto-create store on first write (agent-friendly behavior)
- [ ] 2.2 Implement auto-create category on add (same as CLI)

## 3. Registration

- [ ] 3.1 Create `src/server/memory/index.ts` - register tools with MCP server

## 4. Input Validation

- [ ] 4.1 Add Zod schemas for all tool parameters
- [ ] 4.2 Validate path format
- [ ] 4.3 Validate date format for `expires_at`

## 5. Testing

- [ ] 5.1 Write unit tests for each memory tool
- [ ] 5.2 Write integration tests for auto-creation behavior
- [ ] 5.3 Write tests for expired memory handling
