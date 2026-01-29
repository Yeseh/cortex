---
created_at: 2026-01-29T19:53:51.691Z
updated_at: 2026-01-29T19:53:51.691Z
tags:
  - standard
  - architecture
  - mcp
  - server
  - domain-driven
source: mcp
---
# MCP Server as Thin Wrapper

## Standard
The MCP server layer should be a thin wrapper that:
1. Parses and validates input (using Zod schemas)
2. Calls domain operations from `src/core/`
3. Formats responses for MCP protocol

## Anti-pattern
MCP tools should NOT:
- Directly call filesystem operations (`mkdir`, `readFile`, etc.)
- Contain business logic (validation beyond input parsing, coordination logic)
- Duplicate logic that exists in domain operations

## Rationale
- Domain model drives logic, MCP just exposes it
- Improves testability (test domain operations independently)
- Enables portability (swap storage backends without changing MCP layer)
- Makes code easier to reason about (single source of truth)
- Prevents code duplication and drift

## Example
```typescript
// Good: MCP tool calls domain operation
export const addMemoryHandler = async (ctx, input) => {
    const adapter = ctx.registry.getStore(input.store);
    if (!adapter.ok) throw new McpError(...);
    
    const result = await createMemory(adapter.value, input.path, {
        content: input.content,
        tags: input.tags,
        source: 'mcp',
    });
    
    if (!result.ok) throw new McpError(...);
    return { content: [{ type: 'text', text: `Memory created at ${input.path}` }] };
};

// Bad: MCP tool contains business logic
export const addMemoryHandler = async (ctx, input) => {
    await mkdir(storePath, { recursive: true });  // Don't do this!
    const serialized = serializeMemoryFile(...);
    await adapter.writeMemoryFile(...);
    await adapter.reindexCategoryIndexes();  // Coordination logic belongs in domain
};
```

## Related
- `.context/registry-brainstorm.md` - Full brainstorming session