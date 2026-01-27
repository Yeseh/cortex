## 1. Core Category Module

- [x] 1.1 Create `src/core/category/types.ts` with `CategoryStoragePort` interface
- [x] 1.2 Create `src/core/category/operations.ts` with `createCategory`, `setDescription`, `deleteCategory`
- [x] 1.3 Create `src/core/category/index.ts` barrel export
- [x] 1.4 Write unit tests for category operations

## 2. Index Type Changes

- [x] 2.1 Add `description?: string` to `IndexSubcategoryEntry` in `src/core/index/types.ts`
- [x] 2.2 Update YAML serialization to include description field
- [x] 2.3 Update existing tests to handle new field

## 3. Storage Port Implementation

- [x] 3.1 Implement `CategoryStoragePort` in filesystem adapter
- [x] 3.2 Add `updateSubcategoryDescription` method
- [x] 3.3 Add `ensureDirectory` method
- [x] 3.4 Add `deleteDirectory` method (recursive)
- [x] 3.5 Integration tests for storage port

## 4. MCP Category Tools

- [x] 4.1 Create `src/server/category/tools.ts` with tool implementations
- [x] 4.2 Add `cortex_create_category` tool
- [x] 4.3 Add `cortex_set_category_description` tool
- [x] 4.4 Add `cortex_delete_category` tool
- [x] 4.5 Create `src/server/category/index.ts` for registration
- [x] 4.6 Register tools in MCP server

## 5. List Memories Update

- [x] 5.1 Update `list_memories` to include description in subcategory response
- [x] 5.2 Update tests for list_memories with descriptions

## 6. Validation

- [x] 6.1 Test root category protection (setDescription/deleteCategory reject root paths)
- [x] 6.2 Test category persistence when all memories deleted
- [x] 6.3 Test 500 character limit enforcement
- [x] 6.4 Test idempotent createCategory behavior
- [x] 6.5 Test recursive deleteCategory
