## 1. Store Registry Changes

- [x] 1.1 Update `StoreDefinition` interface to include optional `description` field
- [x] 1.2 Update `parseStoreRegistry` to handle description field
- [x] 1.3 Update `serializeStoreRegistry` to output description field
- [x] 1.4 Add unit tests for description parsing and serialization

## 2. MCP List Stores Tool

- [x] 2.1 Create `cortex_list_stores` tool schema with output type
- [x] 2.2 Implement `listStoresHandler` that reads registry and returns stores with descriptions
- [x] 2.3 Register tool in MCP server
- [x] 2.4 Add integration tests for list stores tool

## 3. Documentation

- [x] 3.1 Update memory skill documentation to reference `cortex_list_stores` tool
