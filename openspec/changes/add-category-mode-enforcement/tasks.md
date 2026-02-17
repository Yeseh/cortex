# Tasks: Add Category Mode Enforcement

## 1. Core Category Operations

- [ ] 1.1 Add `CategoryModeContext` parameter to category operations (mode + config-defined paths)
- [ ] 1.2 Update `createCategory` to check mode before creating
- [ ] 1.3 Implement `subcategories` mode check (reject new root categories)
- [ ] 1.4 Update `deleteCategory` to reject config-defined categories
- [ ] 1.5 Update `setDescription` to reject config-defined categories
- [ ] 1.6 Add error codes: `CATEGORY_PROTECTED`, `ROOT_CATEGORY_NOT_ALLOWED`
- [ ] 1.7 Write unit tests for mode enforcement in each operation

## 2. Memory Operations

- [ ] 2.1 Update `createMemory` to require category existence
- [ ] 2.2 Remove implicit category creation from memory creation
- [ ] 2.3 Add error code: `CATEGORY_NOT_FOUND`
- [ ] 2.4 Write unit tests for memory creation with missing category

## 3. MCP Tool Registration

- [ ] 3.1 Read category mode from config at server startup
- [ ] 3.2 Conditionally register `cortex_create_category` (skip in strict mode)
- [ ] 3.3 Conditionally register `cortex_delete_category` (skip in strict mode)
- [ ] 3.4 Pass mode context to tool handlers
- [ ] 3.5 Write integration tests for tool registration by mode

## 4. Error Messages

- [ ] 4.1 Implement actionable error for protected category deletion
- [ ] 4.2 Implement actionable error for subcategories mode root creation
- [ ] 4.3 Implement actionable error for missing category in memory creation
