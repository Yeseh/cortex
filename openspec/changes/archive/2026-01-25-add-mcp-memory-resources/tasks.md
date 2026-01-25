# Tasks: Add MCP Memory Resources

## 1. Implementation

- [x] 1.1 Create `src/server/memory/resources.ts` with resource handlers
- [x] 1.2 Implement `cortex://memory/{store}/{path}` resource for memory content
- [x] 1.3 Implement `cortex://memory/{store}/{path}/` resource for category listing
- [x] 1.4 Register resources with MCP server in `src/server/memory/index.ts`

## 2. URI Handling

- [x] 2.1 Parse and validate `cortex://memory/` URI pattern
- [x] 2.2 Distinguish between leaf (memory) and directory (category) paths
- [x] 2.3 Handle trailing slashes for category requests

## 3. Testing

- [x] 3.1 Write unit tests for memory content resource
- [x] 3.2 Write unit tests for category listing resource
- [x] 3.3 Write tests for invalid path handling
- [x] 3.4 Write tests for non-existent memory/category
