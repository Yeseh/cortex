---
created_at: 2026-01-27T20:20:54.361Z
updated_at: 2026-01-27T20:25:41.151Z
tags: [operations, result-types]
source: mcp
---
Each operation should have its own result type documenting what it returns:

```typescript
export interface CreateCategoryResult {
    path: string;      // The normalized path
    created: boolean;  // True if newly created, false if existed
}

export interface SetDescriptionResult {
    path: string;
    description: string | null;  // null if cleared
}

export interface DeleteCategoryResult {
    path: string;
    deleted: boolean;
}
```

Note: See `projects/cortex/conventions` for idempotency patterns (which operations are idempotent and which are not).