/**
 * Prune memories MCP tool.
 *
 * @module server/memory/tools/prune-memories
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { pruneExpiredMemories } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
} from './shared.ts';

/** Schema for prune_memories tool input */
export const pruneMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    dry_run: z
        .boolean()
        .default(false)
        .describe('Preview which memories would be pruned without deleting them'),
});

/** Input type for prune_memories tool */
export interface PruneMemoriesInput {
    store: string;
    dry_run?: boolean;
}

/**
 * Deletes all expired memories.
 * Delegates to core pruneExpiredMemories operation.
 */
export const pruneMemoriesHandler = async (
    ctx: ToolContext,
    input: PruneMemoriesInput,
): Promise<McpToolResponse> => {
    const adapterResult = resolveStoreAdapter(ctx, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const dryRun = input.dry_run ?? false;

    const result = await pruneExpiredMemories(adapterResult.value, { dryRun });
    if (!result.ok()) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    // Format output for MCP response
    const prunedEntries = result.value.pruned.map((m) => ({
        path: m.path,
        expires_at: m.expiresAt.toISOString(),
    }));

    if (dryRun) {
        const output = {
            dry_run: true,
            would_prune_count: prunedEntries.length,
            would_prune: prunedEntries,
        };

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(output, null, 2),
            }],
        };
    }

    const output = {
        pruned_count: prunedEntries.length,
        pruned: prunedEntries,
    };

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2),
        }],
    };
};
