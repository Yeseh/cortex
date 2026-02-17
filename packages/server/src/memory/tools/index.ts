/**
 * MCP memory tools for CRUD operations on memories.
 *
 * @module server/memory/tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseInput, type ToolContext } from './shared.ts';
import {
    addMemoryHandler,
    addMemoryInputSchema,
    type AddMemoryInput,
} from './add-memory.ts';
import {
    getMemoryHandler,
    getMemoryInputSchema,
    type GetMemoryInput,
} from './get-memory.ts';
import {
    updateMemoryHandler,
    updateMemoryInputSchema,
    type UpdateMemoryInput,
} from './update-memory.ts';
import {
    removeMemoryHandler,
    removeMemoryInputSchema,
    type RemoveMemoryInput,
} from './remove-memory.ts';
import {
    moveMemoryHandler,
    moveMemoryInputSchema,
    type MoveMemoryInput,
} from './move-memory.ts';
import {
    listMemoriesHandler,
    listMemoriesInputSchema,
    type ListMemoriesInput,
} from './list-memories.ts';
import {
    pruneMemoriesHandler,
    pruneMemoriesInputSchema,
    type PruneMemoriesInput,
} from './prune-memories.ts';
import {
    reindexStoreHandler,
    reindexStoreInputSchema,
    type ReindexStoreInput,
} from './reindex-store.ts';
import {
    getRecentMemoriesHandler,
    getRecentMemoriesInputSchema,
    type GetRecentMemoriesInput,
} from './get-recent-memories.ts';

export {
    addMemoryHandler,
    addMemoryInputSchema,
    type AddMemoryInput,
    getMemoryHandler,
    getMemoryInputSchema,
    type GetMemoryInput,
    updateMemoryHandler,
    updateMemoryInputSchema,
    type UpdateMemoryInput,
    removeMemoryHandler,
    removeMemoryInputSchema,
    type RemoveMemoryInput,
    moveMemoryHandler,
    moveMemoryInputSchema,
    type MoveMemoryInput,
    listMemoriesHandler,
    listMemoriesInputSchema,
    type ListMemoriesInput,
    pruneMemoriesHandler,
    pruneMemoriesInputSchema,
    type PruneMemoriesInput,
    reindexStoreHandler,
    reindexStoreInputSchema,
    type ReindexStoreInput,
    getRecentMemoriesHandler,
    getRecentMemoriesInputSchema,
    type GetRecentMemoriesInput,
};

/**
 * Registers all memory tools with the MCP server.
 */
export const registerMemoryTools = (server: McpServer, ctx: ToolContext): void => {
    server.registerTool(
        'cortex_add_memory',
        {
            description: 'Create a new memory with auto-creation of stores and categories',
            inputSchema: addMemoryInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(addMemoryInputSchema, input);
            return addMemoryHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_get_memory',
        {
            description: 'Retrieve memory content and metadata',
            inputSchema: getMemoryInputSchema.shape,
        },

        async (input) => {
            const parsed = parseInput(getMemoryInputSchema, input);
            return getMemoryHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_update_memory',
        {
            description: 'Update memory content or metadata',
            inputSchema: updateMemoryInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(updateMemoryInputSchema, input);
            return updateMemoryHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_remove_memory',
        {
            description: 'Delete a memory',
            inputSchema: removeMemoryInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(removeMemoryInputSchema, input);
            return removeMemoryHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_move_memory',
        {
            description: 'Move or rename a memory',
            inputSchema: moveMemoryInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(moveMemoryInputSchema, input);
            return moveMemoryHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_list_memories',
        {
            description: 'List memories in a category',
            inputSchema: listMemoriesInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(listMemoriesInputSchema, input);
            return listMemoriesHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_prune_memories',
        {
            description: 'Delete all expired memories',
            inputSchema: pruneMemoriesInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(pruneMemoriesInputSchema, input);
            return pruneMemoriesHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_reindex_store',
        {
            description: 'Rebuild category indexes for a store',
            inputSchema: reindexStoreInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(reindexStoreInputSchema, input);
            return reindexStoreHandler(ctx, parsed);
        },
    );

    server.registerTool(
        'cortex_get_recent_memories',
        {
            description: 'Retrieve the N most recently updated memories across a store or category',
            inputSchema: getRecentMemoriesInputSchema.shape,
        },
        async (input) => {
            const parsed = parseInput(getRecentMemoriesInputSchema, input);
            return getRecentMemoriesHandler(ctx, parsed);
        },
    );
};
