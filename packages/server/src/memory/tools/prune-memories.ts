/**
 * Prune memories MCP tool.
 *
 * @module server/memory/tools/prune-memories
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { type McpToolResponse, textResponse } from '../../response.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

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
 * Uses the fluent API via store.root().prune().
 */
export const pruneMemoriesHandler = async (
    ctx: CortexContext,
    input: PruneMemoriesInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_prune_memories', input.store, async () => {
        ctx.logger?.debug('cortex_prune_memories invoked', { store: input.store, dry_run: input.dry_run ?? false });
        const dryRun = input.dry_run ?? false;
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            ctx.logger?.debug('cortex_prune_memories failed', { store: input.store, error_code: storeResult.error.code });
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }

        const store = storeResult.value;
        const rootClient = store.root();
        if (!rootClient.ok()) {
            ctx.logger?.error('cortex_prune_memories failed', undefined, { store: input.store, error_code: rootClient.error.code });
            throw new McpError(ErrorCode.InternalError, rootClient.error.message);
        }

        const result = await rootClient.value.prune({
            dryRun,
        });
        if (!result.ok()) {
            ctx.logger?.error('cortex_prune_memories failed', undefined, { store: input.store, error_code: result.error.code });
            throw new McpError(ErrorCode.InternalError, result.error.message);
        }

        // Format output for MCP response
        const prunedEntries = result.value.pruned.map((m) => ({
            path: m.path.toString(),
            expires_at: m.expiresAt.toISOString(),
        }));

        const output = dryRun
            ? {
                  dry_run: true,
                  would_prune_count: prunedEntries.length,
                  would_prune: prunedEntries,
              }
            : {
                  pruned_count: prunedEntries.length,
                  pruned: prunedEntries,
              };

        ctx.logger?.debug('cortex_prune_memories succeeded', { store: input.store, dry_run: dryRun, count: prunedEntries.length });
        return textResponse(JSON.stringify(output, null, 2));
    });
};
