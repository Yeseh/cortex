---
created_at: 2026-01-27T20:47:58.418Z
updated_at: 2026-01-27T20:47:58.418Z
tags: [design, validation, domain-modeling, factory-pattern]
source: mcp
---
Design Principle: Unified Domain Entities with Factory Validation

Context: The codebase has multiple types representing similar concepts (e.g., CategoryIndex, OutputCategory). This creates complexity and duplicated validation logic.

Preferred Approach:
1. Use a single domain class per concept (e.g., one `Category` class instead of `CategoryIndex` + `OutputCategory`)
2. Implement static factory methods or factory functions that perform validation
3. Factory methods guarantee objects are always in a valid state upon construction
4. This eliminates the need for validation during serialization or other operations

Benefits:
- Fewer types to maintain
- Validation happens once at construction time
- Downstream code can assume valid state
- Simpler serialization (no per-field validation needed)

Example pattern:
```typescript
class Category {
  private constructor(readonly path: string, readonly memories: Memory[]) {}
  
  static create(path: string, memories: Memory[]): Result<Category, ValidationError> {
    if (!path.trim()) return err({ code: 'INVALID_PATH', message: 'Path required' });
    return ok(new Category(path.trim(), memories));
  }
}
```

Tags: design, validation, domain-modeling, factory-pattern