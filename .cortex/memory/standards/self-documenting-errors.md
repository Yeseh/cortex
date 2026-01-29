---
created_at: 2026-01-27T20:20:44.344Z
updated_at: 2026-01-27T20:20:44.344Z
tags: [errors, ux, agents, self-documenting]
source: mcp
---
Error messages MUST include actionable guidance for the caller (human or AI agent) on how to fix or mitigate the issue. This makes tools self-documenting for agents using them.

**Pattern:**
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

**Principles:**
- Include the failing value in context (e.g., the path that wasn't found)
- Suggest the correct API call to fix the issue
- Provide alternatives when applicable
- Be specific about constraints (e.g., exact max length, not just "too long")