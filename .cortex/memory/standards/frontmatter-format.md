---
created_at: 2026-01-29T16:36:25.749Z
updated_at: 2026-01-29T16:36:25.749Z
tags: [standards, frontmatter, yaml, formatting]
source: mcp
---
Memory files use YAML frontmatter with **snake_case** keys in files and **camelCase** in the internal TypeScript API:

**File format (snake_case):**
```yaml
---
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
tags: [example, test]
source: user
expires_at: 2024-12-31T23:59:59.000Z  # optional
---
Memory content here.
```

**Internal API (camelCase):**
```typescript
interface MemoryMetadata {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    source: string;
    expiresAt?: Date;
}
```

The `parseMemory()` and `serializeMemory()` functions in `filesystem/memories.ts` handle the conversion between snake_case (files) and camelCase (TypeScript).