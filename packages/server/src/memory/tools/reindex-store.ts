/**
 * Reindex store MCP tool.
 *
 * @module server/memory/tools/reindex-store
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import {
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
} from './shared.ts';

/** Schema for reindex_store tool input */
export const reindexStoreInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
});

/** Input type for reindex_store tool */
export interface ReindexStoreInput {
    store: string;
}

/**
 * Rebuilds all category indexes for a store from the filesystem state.
 *
 * This is a repair operation that scans all categories and regenerates
 * their index files. Use when indexes may be out of sync with actual
 * memory files on disk, such as after manual file modifications or
 * corruption recovery.
 *
 * The operation returns any warnings about files that could not be
 * indexed normally, such as files with paths that normalize to empty
 * strings or collisions between normalized paths.
 *
 * @param ctx - Tool context containing server configuration
 * @param input - Input containing the store name to reindex
 * @returns MCP response with store name and any reindex warnings
 * @throws {McpError} When store resolution fails (InvalidParams) or
 *                    reindex operation errors (InternalError)
 */
export const reindexStoreHandler = async (
    ctx: ToolContext,
    input: ReindexStoreInput,
): Promise<McpToolResponse> => {
    const adapterResult = resolveStoreAdapter(ctx, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await adapterResult.value.indexes.reindex();
    if (!result.ok()) {
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
