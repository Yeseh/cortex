# Tasks: Add MCP Store Tools

## 1. Implementation

- [ ] 1.1 Create `src/server/store/tools.ts` with tool definitions
- [ ] 1.2 Implement `list_stores` tool - enumerate stores in data folder
- [ ] 1.3 Implement `create_store` tool - create new store with name parameter
- [ ] 1.4 Create `src/server/store/index.ts` - register tools with MCP server

## 2. Input Validation

- [ ] 2.1 Add Zod schemas for tool parameters
- [ ] 2.2 Validate store name format (alphanumeric, hyphens, underscores)

## 3. Testing

- [ ] 3.1 Write unit tests for `list_stores` tool
- [ ] 3.2 Write unit tests for `create_store` tool
- [ ] 3.3 Write integration tests for tool registration
