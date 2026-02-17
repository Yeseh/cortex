/**
 * MCP memory tools and resources module.
 *
 * This module provides MCP tools for memory CRUD operations, enabling
 * AI agents to create, read, update, delete, move, list, and prune memories.
 * It also provides MCP resources for browsing and discovery.
 *
 * @module server/memory
 *
 * @example
 * ```ts
 * import { registerMemoryTools, registerMemoryResources } from './memory';
 * import { createMcpServer } from './mcp';
 * import type { ToolContext } from './memory/tools/shared';
 *
 * const ctx: ToolContext = { config, cortex };
 * const server = createMcpServer();
 * registerMemoryTools(server, ctx);
 * registerMemoryResources(server, ctx);
 * ```
 */

export {
    registerMemoryTools,
    // Schemas for external use
    addMemoryInputSchema,
    getMemoryInputSchema,
    updateMemoryInputSchema,
    removeMemoryInputSchema,
    moveMemoryInputSchema,
    listMemoriesInputSchema,
    pruneMemoriesInputSchema,
    getRecentMemoriesInputSchema,
    // Types
    type AddMemoryInput,
    type GetMemoryInput,
    type UpdateMemoryInput,
    type RemoveMemoryInput,
    type MoveMemoryInput,
    type ListMemoriesInput,
    type PruneMemoriesInput,
    type GetRecentMemoriesInput,
    // Handlers for testing
    addMemoryHandler,
    getMemoryHandler,
    updateMemoryHandler,
    removeMemoryHandler,
    moveMemoryHandler,
    listMemoriesHandler,
    pruneMemoriesHandler,
    getRecentMemoriesHandler,
} from './tools/index.ts';

export { registerMemoryResources } from './resources.ts';
