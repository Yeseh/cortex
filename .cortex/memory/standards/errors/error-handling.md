---
created_at: 2026-02-05T19:21:39.989Z
updated_at: 2026-02-05T19:21:39.989Z
tags:
  - errors
  - patterns
  - self-documenting
  - types
source: mcp
---
# Error Handling Standards

## Discriminated Union Error Types

All errors use a consistent structure with discriminated union codes.

### Error Structure
```typescript
interface DomainError {
    code: DomainErrorCode;    // Machine-readable discriminant
    message: string;          // Human-readable message
    path?: string;            // Context: affected path
    field?: string;           // Context: affected field
    cause?: unknown;          // Underlying error
}
```

### Error Codes by Domain
- **MemoryErrorCode**: MEMORY_NOT_FOUND, INVALID_PATH, STORAGE_ERROR, etc.
- **CategoryErrorCode**: CATEGORY_NOT_FOUND, ROOT_CATEGORY_REJECTED, etc.
- **RegistryErrorCode**: REGISTRY_MISSING, STORE_NOT_FOUND, etc.
- **StorageAdapterErrorCode**: READ_FAILED, WRITE_FAILED, etc.

## Self-Documenting Error Messages

Error messages MUST include actionable guidance for the caller (human or AI agent) on how to fix or mitigate the issue.

### Pattern
```typescript
return err({
    code: 'CATEGORY_NOT_FOUND',
    message: `Category not found: ${path}. Create it first with createCategory('${path}') or check the path is correct.`,
    path,
});

return err({
    code: 'ROOT_CATEGORY_REJECTED',
    message: 'Cannot set description on root category. Use a subcategory path like "project/my-category" instead.',
    path,
});

return err({
    code: 'DESCRIPTION_TOO_LONG',
    message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters. Current length: ${trimmed.length}. Shorten the description or split into multiple memories.`,
    path,
});
```

### Principles
- Include the failing value in context (e.g., the path that wasn't found)
- Suggest the correct API call to fix the issue
- Provide alternatives when applicable
- Be specific about constraints (e.g., exact max length, not just "too long")

## Benefits
- Type-safe error discrimination with switch statements
- Rich context for debugging
- Consistent pattern across all modules
- Maps cleanly to HTTP/MCP error codes at boundaries
- Self-documenting for agents using the tools