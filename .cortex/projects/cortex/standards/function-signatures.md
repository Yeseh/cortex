---
created_at: 2026-01-27T20:21:03.674Z
updated_at: 2026-01-27T20:21:03.674Z
tags: [functions, signatures, async]
source: mcp
---
Business logic functions follow this signature pattern:

```typescript
export const operationName = async (
    storage: StoragePort,  // Port always first parameter
    ...params: T[]         // Operation-specific parameters
): Promise<Result<OperationResult, DomainError>> => {
    // Implementation
};
```

Pure helper functions (no I/O) omit the storage parameter and are synchronous:

```typescript
export const isRootCategory = (path: string): boolean => {
    // Pure logic
};
```