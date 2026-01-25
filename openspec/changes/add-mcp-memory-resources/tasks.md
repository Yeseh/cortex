# Tasks: Add MCP Memory Resources

## 1. Implementation

- [ ] 1.1 Create `src/server/memory/resources.ts` with resource handlers
- [ ] 1.2 Implement `cortex://memory/{store}/{path}` resource for memory content
- [ ] 1.3 Implement `cortex://memory/{store}/{path}/` resource for category listing
- [ ] 1.4 Register resources with MCP server in `src/server/memory/index.ts`

## 2. URI Handling

- [ ] 2.1 Parse and validate `cortex://memory/` URI pattern
- [ ] 2.2 Distinguish between leaf (memory) and directory (category) paths
- [ ] 2.3 Handle trailing slashes for category requests

## 3. Testing

- [ ] 3.1 Write unit tests for memory content resource
- [ ] 3.2 Write unit tests for category listing resource
- [ ] 3.3 Write tests for invalid path handling
- [ ] 3.4 Write tests for non-existent memory/category
