---
{created_at: 2026-02-17T20:44:46.043Z,updated_at: 2026-02-17T20:44:46.043Z,tags: [decision,architecture,validation,fluent-api,azure-sdk],source: mcp}
---
# Decision: Lazy Validation Pattern

## Date
2026-02-17

## Context
The fluent client API needs to support method chaining like `store.rootCategory().getCategory('path').getMemory('slug')`. These navigation methods must be synchronous for fluent chaining, but path validation could fail.

## Decision
Client creation is synchronous and accepts invalid input. Validation errors surface on the first async operation.

```typescript
// Synchronous - succeeds even with invalid path
const category = store.rootCategory().getCategory('invalid//path');
const memory = category.getMemory('INVALID SLUG!!!');

// Validation happens here - returns Result with error
const result = await memory.get();
// result.error.code === 'INVALID_PATH'
```

## Implementation
- Clients store raw strings as properties: `rawPath`, `rawSlug`
- Explicit `parse*()` methods return `Result<ValueObject, PathError>`
- Async operations validate internally before proceeding

```typescript
class MemoryClient {
    readonly rawPath: string;      // Always accessible
    readonly rawSlug: string;      // Always accessible
    
    parsePath(): Result<MemoryPath, PathError>  // Explicit validation
    parseSlug(): Result<Slug, PathError>
}
```

## Rationale
- Matches Azure SDK design patterns
- Keeps navigation API clean and chainable
- Validation errors appear where operations happen
- Properties always accessible (no exceptions on access)

## References
- Azure SDK Design Guidelines: https://azure.github.io/azure-sdk/general_introduction.html