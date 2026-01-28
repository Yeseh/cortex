# Change: Refactor core index module with process standards

## Why

The `src/core/index/` module is missing comprehensive documentation and does not follow the project's established module patterns demonstrated in `src/core/category/`. Specifically:

1. **Missing JSDoc documentation** - Types and error codes lack `@module`, `@example`, and detailed descriptions
2. **No operations module** - Business logic helpers (like index manipulation utilities) are missing
3. **Inconsistent type documentation** - Error codes lack explanation of when each code is returned
4. **Missing constants** - Magic values not extracted to documented constants

The `src/core/category/` module exemplifies the project's architecture standards with well-documented types, pure operations, and clear module boundaries.

## What Changes

### 1. Add comprehensive JSDoc to types.ts

- Add `@module core/index/types` header
- Document each interface with purpose and field explanations
- Document error codes with conditions when each is returned
- Add `@example` blocks showing typical usage patterns

### 2. Create operations.ts module

- Extract pure index manipulation helpers (if any emerge from current parser)
- Follow `category/operations.ts` pattern with documented pure functions
- Example operations: index entry lookup, validation helpers

### 3. Align error handling patterns

- Ensure `IndexParseError` and `IndexSerializeError` follow `CategoryError` structure
- Add optional `cause` field for underlying errors (forward compatibility)
- Document error recovery patterns

### 4. Update barrel export

- Export operations alongside types
- Maintain backward compatibility with existing consumers

## Impact

- Affected specs: `index`
- Affected code:
    - `src/core/index/types.ts` - Add documentation, potentially add fields
    - `src/core/index/operations.ts` - New file (optional, if operations emerge)
    - `src/core/index/index.ts` - Update exports

## Dependencies

- **After:** `refactor-serialization-module` - Wait for parser deletion before creating operations
- This proposal focuses on documentation and structure, not serialization logic

## Non-Breaking

- No API changes - only documentation and internal structure improvements
- Existing consumers continue to work unchanged
- Error types gain optional fields (backward compatible)
