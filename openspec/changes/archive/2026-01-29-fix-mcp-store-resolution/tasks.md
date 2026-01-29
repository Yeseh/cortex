## 1. Core library: Add store path resolution

- [x] 1.1 Add `resolveStorePath(registry, storeName)` function to `core/store/registry.ts`
- [x] 1.2 Return error if store name not found in registry
- [x] 1.3 Add unit tests for `resolveStorePath`

## 2. Update MCP memory tools

- [x] 2.1 Load store registry at start of each tool handler
- [x] 2.2 Replace `resolveStoreRoot` implementation to use `resolveStorePath`
- [x] 2.3 Update tests to verify registry-based resolution

## 3. Update MCP category tools

- [x] 3.1 Update `resolveStoreRoot` in category tools to use registry
- [x] 3.2 Update tests to verify registry-based resolution

## 4. Validation

- [x] 4.1 Run full test suite
- [x] 4.2 Manual verification with actual stores
