/**
 * Get memory MCP tool.
 *
 * @module server/memory/tools/get-memory
 */

import { z } from 'zod';
import { getMemory } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    memoryPathSchema,
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
    translateMemoryError,
} from './shared.ts';

/** Schema for get_memory tool input */
export const getMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    include_expired: z.boolean().optional().default(false).describe('Include expired memories'),
});

/** Input type for get_memory tool */
export interface GetMemoryInput {
    store: string;
    path: string;
    include_expired?: boolean;
}

/**
 * Retrieves memory content and metadata.
 */
export const getMemoryHandler = async (
    ctx: ToolContext,
    input: GetMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await getMemory(adapterResult.value, input.path, {
        includeExpired: input.include_expired,
    });

    if (!result.ok()) {
        throw translateMemoryError(result.error);
    }

    const memory = result.value;
    const output = {
        path: input.path,
        content: memory.content,
        metadata: {
            created_at: memory.metadata.createdAt.toISOString(),
            updated_at: memory.metadata.updatedAt?.toISOString(),
            tags: memory.metadata.tags,
            source: memory.metadata.source,
            expires_at: memory.metadata.expiresAt?.toISOString(),
            citations: memory.metadata.citations,
        },
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};
