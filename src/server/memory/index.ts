/**
 * MCP memory tools module.
 *
 * This module provides MCP tools for memory CRUD operations, enabling
 * AI agents to create, read, update, delete, move, list, and prune memories.
 *
 * @module server/memory
 *
 * @example
 * ```ts
 * import { registerMemoryTools } from './memory';
 * import { createMcpServer } from './mcp';
 * import { loadServerConfig } from './config';
 *
 * const configResult = loadServerConfig();
 * if (configResult.ok) {
 *   const server = createMcpServer();
 *   registerMemoryTools(server, configResult.value);
 * }
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
    // Types
    type AddMemoryInput,
    type GetMemoryInput,
    type UpdateMemoryInput,
    type RemoveMemoryInput,
    type MoveMemoryInput,
    type ListMemoriesInput,
    type PruneMemoriesInput,
    // Handlers for testing
    addMemoryHandler,
    getMemoryHandler,
    updateMemoryHandler,
    removeMemoryHandler,
    moveMemoryHandler,
    listMemoriesHandler,
    pruneMemoriesHandler,
} from './tools.ts';
