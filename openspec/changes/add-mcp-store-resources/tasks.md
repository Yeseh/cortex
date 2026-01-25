# Tasks: Add MCP Store Resources

## 1. Implementation

- [ ] 1.1 Create `src/server/store/resources.ts` with resource handlers
- [ ] 1.2 Implement `cortex://store/` resource - list all stores
- [ ] 1.3 Implement `cortex://store/{name}` resource - store metadata and root listing
- [ ] 1.4 Register resources with MCP server in `src/server/store/index.ts`

## 2. URI Handling

- [ ] 2.1 Parse and validate `cortex://` URI scheme
- [ ] 2.2 Handle trailing slashes consistently

## 3. Testing

- [ ] 3.1 Write unit tests for store listing resource
- [ ] 3.2 Write unit tests for store detail resource
- [ ] 3.3 Write tests for invalid URI handling
