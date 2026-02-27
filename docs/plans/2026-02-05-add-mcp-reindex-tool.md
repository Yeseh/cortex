# MCP Reindex Tool Implementation Plan

**Goal:** Add a `cortex_reindex_store` tool to the MCP server that rebuilds category indexes for a specified store
**Architecture:** Follow the existing MCP memory tools pattern - Zod schema for input validation, handler function delegating to domain operation, tool registration with parseInput helper
**Tech Stack:** TypeScript, Zod, MCP SDK, cortex-core storage interfaces
**Session Id:** ses_3d09207a8ffezLcy3vkswciRrp

---

## Task Breakdown

### 1. Implementation Tasks (packages/server/src/memory/tools.ts)

#### 1.1 Add Zod Schema

Add `reindexStoreInputSchema` following the existing pattern:

```typescript
/** Schema for reindex_store tool input */
export const reindexStoreInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
});
```

Location: After line 117 (after `pruneMemoriesInputSchema`)

#### 1.2 Add TypeScript Interface

Add `ReindexStoreInput` interface following existing pattern:

```typescript
/** Input type for reindex_store tool */
export interface ReindexStoreInput {
    store: string;
}
```

Location: After line 173 (after `PruneMemoriesInput` interface)

#### 1.3 Implement Handler Function

Add `reindexStoreHandler` function following the `pruneMemoriesHandler` pattern:

```typescript
/**
 * Rebuilds category indexes for a store.
 * Delegates to the storage adapter's reindex operation.
 */
export const reindexStoreHandler = async (
    ctx: ToolContext,
    input: ReindexStoreInput
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store, false);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const result = await adapterResult.value.indexes.reindex();
    if (!result.ok) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    const output = {
        store: input.store,
        warnings: result.value.warnings,
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};
```

Location: After `pruneMemoriesHandler` (after line 575)

#### 1.4 Register Tool

Register `cortex_reindex_store` in `registerMemoryTools`:

```typescript
// cortex_reindex_store
server.tool(
    'cortex_reindex_store',
    'Rebuild category indexes for a store',
    reindexStoreInputSchema.shape,
    async (input) => {
        const parsed = parseInput(reindexStoreInputSchema, input);
        return reindexStoreHandler(ctx, parsed);
    }
);
```

Location: At end of `registerMemoryTools` (before the closing brace, after cortex_prune_memories)

### 2. Testing Tasks (packages/server/src/memory/tools.spec.ts)

#### 2.1 Add Imports

Import the new schema and types:

```typescript
import {
    // ... existing imports ...
    reindexStoreHandler,
    reindexStoreInputSchema,
    type ReindexStoreInput,
} from './tools.ts';
```

#### 2.2 Add Test Suite

Add `describe('cortex_reindex_store tool', ...)` test suite after the prune_memories tests:

```typescript
describe('cortex_reindex_store tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should rebuild category indexes successfully', async () => {
        // Create a memory to have something to index
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/test-memory', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Test content',
        });

        const input: ReindexStoreInput = {
            store: 'default',
        };

        const result = await reindexStoreHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.store).toBe('default');
        expect(output.warnings).toBeDefined();
        expect(Array.isArray(output.warnings)).toBe(true);
    });

    it('should return error for non-existent store', async () => {
        const input: ReindexStoreInput = {
            store: 'non-existent-store',
        };

        await expect(reindexStoreHandler({ config }, input)).rejects.toThrow('not registered');
    });
});
```

#### 2.3 Add Schema Validation Tests

Add tests in the "memory tool schemas reject missing store parameter" section:

```typescript
it('should reject reindex_store without store parameter', () => {
    const input = {};
    const result = reindexStoreInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
    }
});

// Add to the "should accept valid input with store parameter" test:
const reindexInput = { store: 'default' };
expect(reindexStoreInputSchema.safeParse(reindexInput).success).toBe(true);
```

## Dependencies

```
1.1 (Schema) ─┬─> 1.2 (Interface) ─> 1.3 (Handler) ─> 1.4 (Registration)
              │
              └─> 2.1 (Test Imports) ─> 2.2 (Test Suite) ─> 2.3 (Schema Tests)
```

Implementation tasks 1.1-1.4 are sequential (each depends on the previous).
Testing tasks 2.1-2.3 can start after 1.1 is complete (schema is needed for tests).

## Verification

1. Run `bun test packages/server/src/memory/tools.spec.ts` - all tests should pass
2. Run `bun run build` - should compile without errors
3. Run `bun run lint` - should pass without errors

## Export Updates Required

The new exports need to be available:

- `reindexStoreInputSchema`
- `ReindexStoreInput` type
- `reindexStoreHandler` function

These are automatically exported as they're in the same file as other tools.
