# Tasks: Add MCP Store Resources

## 1. Implementation

- [x] 1.1 Create `src/server/store/resources.ts` with resource handlers
- [x] 1.2 Implement `cortex://store/` resource - list all stores
- [x] 1.3 Implement `cortex://store/{name}` resource - store metadata and root listing
- [x] 1.4 Register resources with MCP server in `src/server/store/index.ts`

## 2. URI Handling

- [x] 2.1 Parse and validate `cortex://` URI scheme
- [x] 2.2 Handle trailing slashes consistently

## 3. Testing

- [x] 3.1 Write unit tests for store listing resource
- [x] 3.2 Write unit tests for store detail resource
- [x] 3.3 Write tests for invalid URI handling
