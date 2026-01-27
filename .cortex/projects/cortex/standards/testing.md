---
created_at: 2026-01-27T20:21:00.849Z
updated_at: 2026-01-27T20:21:00.849Z
tags: [testing, mocks, bun-test]
source: mcp
---
Test files are colocated with source: `{filename}.spec.ts`

**Mock Factory Pattern:**
Create a factory function returning a mock implementation of the port interface:

```typescript
const createMockStorage = (overrides: Partial<CategoryStorage> = {}): CategoryStorage => ({
    categoryExists: mock(async () => ok(false)),
    readCategoryIndex: mock(async () => ok(null)),
    writeCategoryIndex: mock(async () => ok(undefined)),
    ensureCategoryDirectory: mock(async () => ok(undefined)),
    deleteCategoryDirectory: mock(async () => ok(undefined)),
    updateSubcategoryDescription: mock(async () => ok(undefined)),
    removeSubcategoryEntry: mock(async () => ok(undefined)),
    ...overrides,
});
```

**Test Organization:**
- Use `describe` blocks per function
- Each `it` block tests one specific behavior
- Name tests as "should {expected behavior}"
- Test both success and error paths
- Test edge cases (empty strings, boundary values, etc.)

**Type Assertions:**
Use `as` assertions when Bun test type inference needs help:
```typescript
expect(capturedDesc as string | null).toBe('trimmed');
```