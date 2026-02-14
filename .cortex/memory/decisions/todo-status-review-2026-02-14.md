---
created_at: 2026-02-14T21:19:11.306Z
updated_at: 2026-02-14T21:20:44.753Z
tags:
  - review
  - todo
  - status
  - testing
source: mcp
expires_at: 2026-02-21T23:59:59.000Z
---
# TODO Status Review - 2026-02-14

Reviewed all pending todos to determine which have been completed and which are still outstanding.

## ✅ COMPLETED / NO LONGER APPLICABLE

### 1. todo/create-category-error-type
**Status**: ✅ COMPLETED

Evidence from codebase review:
- `CategoryError` type exists in `packages/core/src/category/types.ts`
- `CategoryErrorCode` union defined with codes: INVALID_PATH, ROOT_CATEGORY_REJECTED, CATEGORY_NOT_FOUND, STORAGE_ERROR
- Category operations use `CategoryError` instead of `MemoryError`
- Exports present in `packages/core/src/category/index.ts`

**Action**: Can be removed from todos.

### 2. todo/storage-fs-domain-objects
**Status**: ✅ COMPLETED

Evidence from codebase review:
- `FilesystemMemoryStorage.read()` returns `Result<Memory | null, StorageAdapterError>` (domain object)
- `FilesystemMemoryStorage.write()` accepts `Memory` (domain object)
- Serialization happens inside storage layer via `serializeMemory()` and `parseMemory()`
- Methods accept `MemoryPath` objects instead of strings
- Storage adapter properly encapsulates serialization concerns

**Action**: Can be removed from todos.

### 3. todo/refactor-incomplete-files (partially)
**Status**: ⚠️ PARTIALLY COMPLETED

**Completed**:
- CategoryPath now has its own error type (CategoryError)
- No longer uses MemoryError from memory module

**Still Outstanding**:
- Need to verify if `update.ts` was refactored to match new patterns
- From reading the file, it appears to be using the new patterns:
  - Imports from `@/memory/memory.ts` and `@/memory/memory-path.ts` (new structure)
  - Uses `MemoryPath.fromPath()` 
  - Uses domain objects

**Action**: Review update.ts more carefully, but appears mostly fixed. Can likely be removed.

## 🔄 STILL OUTSTANDING

### 4. todo/decrease-mcp-fs-coupling
**Status**: 🔄 STILL VALID

**Description**: Decouple MCP server from filesystem-specific storage implementations.

**Why Still Valid**: This is an architectural improvement, not a bug fix. Still relevant for future work.

**Priority**: Low-Medium

### 5. todo/merge-categories-indexes
**Status**: 🔄 STILL VALID

**Description**: Consolidate overlapping category and index concepts in core.

**Why Still Valid**: This is an architectural consolidation. Still relevant for future work.

**Priority**: Medium

### 6. todo/refactor-index-storage-structured
**Status**: 🔄 STILL VALID

**Description**: Move index parsing into storage adapters, have IndexStorage.read() return structured data.

**Why Still Valid**: This is a prerequisite for SQLite index layer. Important architectural change.

**Priority**: High (if SQLite work is planned)

### 7. todo/review-registry-implementation
**Status**: 🔄 STILL VALID

**Description**: Audit registry for correctness, performance, and API surface issues.

**Why Still Valid**: This is an audit/review task. Always relevant.

**Priority**: Medium

## 🆕 NEW ISSUES FROM TESTING

### 8. todo/fix-mcp-create-store-registration
**Status**: 🐛 NEW BUG

**Description**: `cortex_create_store` returns success but store is not registered.

**Severity**: Medium - Feature broken for dynamic store creation

**Priority**: High

### 9. todo/verify-category-description-persistence
**Status**: 🐛 NEW BUG

**Description**: `cortex_set_category_description` may not persist to index.yaml correctly.

**Severity**: Low - Non-critical feature

**Priority**: Low

## Summary

**Total Todos**: 9
- ✅ Completed: 3 (create-category-error-type, storage-fs-domain-objects, refactor-incomplete-files)
- 🔄 Still Valid: 4 (decrease-mcp-fs-coupling, merge-categories-indexes, refactor-index-storage-structured, review-registry-implementation)
- 🆕 New Bugs: 2 (fix-mcp-create-store-registration, verify-category-description-persistence)

## Recommended Actions

1. **Remove completed todos** with expiration dates (they expire in 2 days anyway)
2. **Keep architectural todos** (decrease-mcp-fs-coupling, merge-categories-indexes, refactor-index-storage-structured, review-registry-implementation)
3. **Prioritize new bugs** from testing session
4. **Fix high-priority bug**: fix-mcp-create-store-registration (MCP server create_store not registering)