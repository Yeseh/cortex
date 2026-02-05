---
created_at: 2026-02-05T19:32:49.104Z
updated_at: 2026-02-05T19:32:49.104Z
tags:
  - testing
  - mocks
  - patterns
source: mcp
---
# Mock Factory Pattern

Create factory functions returning mock implementations of port interfaces with sensible defaults and override support:

```typescript
const createMockStorage = (overrides: Partial<CategoryStorage> = {}): CategoryStorage => ({
    categoryExists: mock(async () => ok(false)),
    readCategoryIndex: mock(async () => ok(null)),
    writeCategoryIndex: mock(async () => ok(undefined)),
    // ... other methods
    ...overrides,
});
```

Benefits: Consistent mocks, easy to customize per test, type-safe.