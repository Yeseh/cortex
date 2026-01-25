# Tasks: Add MCP Memory Tools

## 1. Tool Implementation

- [x] 1.1 Create `src/server/memory/tools.ts` with tool definitions
- [x] 1.2 Implement `add_memory` tool with parameters: `store?`, `path`, `content`, `tags?`, `expires_at?`
- [x] 1.3 Implement `get_memory` tool with parameters: `store?`, `path`, `include_expired?`
- [x] 1.4 Implement `update_memory` tool with parameters: `store?`, `path`, `content?`, `tags?`, `expires_at?`, `clear_expiry?`
- [x] 1.5 Implement `remove_memory` tool with parameters: `store?`, `path`
- [x] 1.6 Implement `move_memory` tool with parameters: `store?`, `from_path`, `to_path`
- [x] 1.7 Implement `list_memories` tool with parameters: `store?`, `category?`, `include_expired?`
- [x] 1.8 Implement `prune_memories` tool with parameters: `store?`

## 2. Auto-Creation Behavior

- [x] 2.1 Implement auto-create store on first write (agent-friendly behavior)
- [x] 2.2 Implement auto-create category on add (same as CLI)

## 3. Registration

- [x] 3.1 Create `src/server/memory/index.ts` - register tools with MCP server
- [x] 3.2 Integrate tool registration into MCP server startup (`src/server/index.ts`)

## 4. Input Validation

- [x] 4.1 Add Zod schemas for all tool parameters
- [x] 4.2 Validate path format
- [x] 4.3 Validate date format for `expires_at`

## 5. Testing

- [x] 5.1 Write unit tests for each memory tool
- [x] 5.2 Write integration tests for auto-creation behavior
- [x] 5.3 Write tests for expired memory handling
