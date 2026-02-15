---
created_at: 2026-02-15T11:12:08.565Z
updated_at: 2026-02-15T11:12:08.565Z
tags:
  - mcp
  - architecture
  - best-practice
  - patterns
source: mcp
---
# MCP Tool Pattern: Thin Wrapper Delegation

## Principle
MCP tools in `packages/server` MUST be thin wrappers that delegate to core operations. They should NOT contain business logic.

## Example: Store Creation
**Wrong approach:**
```typescript
// Don't reimplement in server
async ({ name }) => {
    await fs.mkdir(storePath);
    await registry.load();
    await registry.save({ ...current, [name]: { path: storePath } });
}
```

**Correct approach:**
```typescript
// Delegate to core operation
import { initializeStore } from '@yeseh/cortex-core/store';

async ({ name }) => {
    const result = await initializeStore(registry, name, storePath);
    // Just format the result for MCP
}
```

## Benefits
1. Single source of truth for business logic
2. Consistent behavior between CLI and MCP
3. Proper index initialization and edge case handling
4. Less code to maintain (~250 lines removed in store creation fix)

## Related
- PR #26: fix(mcp): register stores in registry when using cortex_create_store
- Architecture: Hexagonal/Ports and Adapters pattern