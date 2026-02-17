---
{created_at: 2026-02-17T20:42:00.882Z,updated_at: 2026-02-17T20:42:00.882Z,tags: [standard,architecture,dependency-injection,handlers,cortex],source: mcp}
---
# CortexContext Pattern for Handlers

## Summary
All CLI and MCP handlers should receive `CortexContext` as a dependency injection mechanism for accessing the Cortex client.

## Interface
```typescript
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
}
```

## Usage

### MCP Server
```typescript
// In ToolContext (extends CortexContext)
export interface ToolContext {
    config: ServerConfig;
    cortex: Cortex;
}

// In handlers
export const myToolHandler = async (ctx: ToolContext, input: MyInput) => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }
    // Use storeResult.value for operations
};
```

### CLI
```typescript
// In context.ts
const cortex = await Cortex.fromConfig(configDir);
const adapter = cortex.getStore(storeName);
```

## Benefits
- Consistent dependency injection across CLI and MCP
- Easier testing via `Cortex.init()` with mock adapters
- Single source of truth for store resolution

## Location
- Interface: `packages/core/src/cortex/types.ts`
- Export: `packages/core/src/cortex/index.ts`

## Related
- PR #38: Initial implementation
- `todo/add-cortex-mutation-methods`: Follow-up for store mutation