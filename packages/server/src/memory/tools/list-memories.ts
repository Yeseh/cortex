/**
 * List memories MCP tool.
 *
 * @module server/memory/tools/list-memories
 */

import { z } from 'zod';
import { listMemories } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
    translateMemoryError,
} from './shared.ts';

/** Schema for list_memories tool input */
export const listMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    category: z
        .string()
        .optional()
        .describe('Category path to list (lists root categories if omitted)'),
    include_expired: z.boolean().optional().default(false).describe('Include expired memories'),
});

/** Input type for list_memories tool */
export interface ListMemoriesInput {
    store: string;
    category?: string;
    include_expired?: boolean;
}

/**
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: ToolContext,
    input: ListMemoriesInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await listMemories(adapterResult.value, {
        category: input.category,
        includeExpired: input.include_expired,
    });

    if (!result.ok()) {
        throw translateMemoryError(result.error);
    }

    const listResult = result.value;
    const output = {
        category: listResult.category || 'all',
        count: listResult.memories.length,
        memories: listResult.memories.map((m) => ({
            path: m.path,
            token_estimate: m.tokenEstimate,
            summary: m.summary,
            expires_at: m.expiresAt?.toISOString(),
            is_expired: m.isExpired,
            updated_at: m.updatedAt?.toISOString(),
        })),
        subcategories: listResult.subcategories.map((s) => ({
            path: s.path,
            memory_count: s.memoryCount,
            description: s.description,
        })),
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};
