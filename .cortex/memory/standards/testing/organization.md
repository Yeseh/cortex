---
created_at: 2026-02-05T19:32:51.467Z
updated_at: 2026-02-05T19:32:51.467Z
tags:
  - testing
  - organization
  - patterns
source: mcp
---
# Test Organization

- Test files colocated with source: `{filename}.spec.ts`
- Use `describe` blocks per function
- Each `it` block tests one specific behavior
- Name tests as "should {expected behavior}"
- Test both success and error paths
- Test edge cases (empty strings, boundary values, etc.)

**Result pattern assertion:**
```typescript
expect(result.ok).toBe(true);  // or false for error case
if (result.ok) expect(result.value).toContain('expected');
if (!result.ok) expect(result.error.code).toBe('ERROR_CODE');
```