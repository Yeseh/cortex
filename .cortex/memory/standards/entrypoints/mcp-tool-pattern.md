---
created_at: 2026-02-05T19:16:50.322Z
updated_at: 2026-02-05T19:16:50.322Z
tags:
  - patterns
  - mcp
  - server
source: mcp
---
# MCP Tool Registration Pattern

MCP tools follow a consistent registration pattern with Zod validation.

## Registration
```typescript
server.tool(
    'cortex_tool_name',        // Tool name
    'Tool description',         // Description for MCP clients
    inputSchema.shape,          // Zod schema shape
    async (input) => {          // Handler
        const parsed = parseInput(schema, input);
        return handler(ctx, parsed);
    }
);
```

## Input Schema
```typescript
export const inputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path'),
    content: z.string().min(1).describe('Content'),
});
```

## Handler Function
```typescript
export const toolHandler = async (
    ctx: ToolContext,
    input: ToolInput,
): Promise<McpToolResponse> => {
    // 1. Resolve store adapter
    // 2. Perform operation
    // 3. Return response
    return {
        content: [{ type: 'text', text: 'Result message' }],
    };
};
```

## Error Handling
- Validation errors → McpError(ErrorCode.InvalidParams)
- Domain errors → Translated via translateError function
- Returns isError: true for error responses