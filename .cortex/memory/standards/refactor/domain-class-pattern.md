---
created_at: 2026-02-14T13:48:21.321Z
updated_at: 2026-02-14T13:48:21.321Z
tags:
  - refactor
  - pattern
  - domain-class
  - validation
  - result-type
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/slug.ts
  - packages/core/src/memory/memory-path.ts
  - packages/core/src/category/category-path.ts
  - packages/core/src/memory/memory.ts
---
# Domain Class Pattern

Classes representing domain values (paths, slugs, identifiers) use this pattern:

## Structure

```typescript
export class DomainClass {
    #privateField: Type; // ES private fields for encapsulation

    private constructor(validatedValue: Type) {
        this.#privateField = validatedValue;
    }

    static fromInput(input: string): Result<DomainClass, DomainError> {
        // 1. Validate input
        if (!isValid(input)) {
            return domainError('ERROR_CODE', 'Human-readable message');
        }
        // 2. Transform/normalize if needed
        const normalized = normalize(input);
        // 3. Return wrapped in Result
        return ok(new DomainClass(normalized));
    }

    // Read-only accessors and methods
    toString(): string {
        return this.#privateField;
    }
}
```

## Key Rules

1. **Private constructor** - Instances only via factory methods
2. **Static factory methods** - `fromPath()`, `fromSegments()`, `from()`, `init()` etc.
3. **Return Result<T, E>** - Never throw, always return typed errors
4. **ES private fields** - Use `#` syntax, not TypeScript `private` keyword
5. **Immutable by design** - No setters, only read accessors

## Examples

- `Slug.from(input)` → `Result<Slug, {message: string}>`
- `MemoryPath.fromPath(path)` → `MemoryResult<MemoryPath>`
- `CategoryPath.fromSegments(segments)` → `Result<CategoryPath, MemoryError>`
- `Memory.init(path, metadata, content)` → `MemoryResult<Memory>`

## Composition

Domain classes can compose other domain classes:
- `MemoryPath` contains `CategoryPath` + `Slug`
- `CategoryPath` contains array of `Slug`