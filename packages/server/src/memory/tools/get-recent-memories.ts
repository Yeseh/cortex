/**
 * Get recent memories MCP tool.
 *
 * @module server/memory/tools/get-recent-memories
 */

import { z } from 'zod';
import { getRecentMemories } from '@yeseh/cortex-core';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import {
    textResponse,
    type McpToolResponse,
} from '../../response.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

/** Schema for get_recent_memories tool input */
export const getRecentMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    category: z
        .string()
        .optional()
        .describe('Category path to scope retrieval (retrieves from all categories if omitted)'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(5)
        .describe('Maximum number of memories to return (default: 5, max: 100)'),
    include_expired: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include expired memories'),
});

/** Input type for get_recent_memories tool */
export interface GetRecentMemoriesInput {
    store: string;
    category?: string;
    limit?: number;
    include_expired?: boolean;
}

/**
 * Retrieves the N most recently updated memories across a store or category.
 *
 * Returns memories sorted by updatedAt descending (newest first), with full
 * content included. Useful for showing recent activity or context to agents.
 *
 * @param ctx - Tool context containing server configuration
 * @param input - Input containing store, optional category, limit, and include_expired
 * @returns MCP response with category, count, and memories array
 * @throws {McpError} When store resolution fails (InvalidParams) or
 *                    retrieval operation errors (InternalError)
 */
export const getRecentMemoriesHandler = async (
    ctx: CortexContext,
    input: GetRecentMemoriesInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_get_recent_memories', input.store, async () => {
        // Get store using fluent API
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }
        const store = storeResult.value;

        // Validate category path if provided
        if (input.category) {
            const categoryResult = store.getCategory(input.category);
            if (!categoryResult.ok()) {
                throw new McpError(ErrorCode.InvalidParams, categoryResult.error.message);
            }
        }

        // Call getRecentMemories operation directly with the adapter
        const result = await getRecentMemories(store.adapter, {
            category: input.category,
            limit: input.limit ?? 5,
            includeExpired: input.include_expired ?? false,
        });

        if (!result.ok()) {
            throw new McpError(ErrorCode.InternalError, result.error.message);
        }

        const recentResult = result.value;
        const output = {
            category: recentResult.category,
            count: recentResult.count,
            memories: recentResult.memories.map((m) => ({
                path: m.path,
                content: m.content,
                updated_at: m.updatedAt?.toISOString() ?? null,
                token_estimate: m.tokenEstimate,
                tags: m.tags,
            })),
        };

        return textResponse(JSON.stringify(output, null, 2));
    });
};
