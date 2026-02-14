/**
 * Remove memory MCP tool.
 *
 * @module server/memory/tools/remove-memory
 */

import { z } from 'zod';
import { removeMemory } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    memoryPathSchema,
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
    translateMemoryError,
} from './shared.ts';

/** Schema for remove_memory tool input */
export const removeMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
});

/** Input type for remove_memory tool */
export interface RemoveMemoryInput {
    store: string;
    path: string;
}

/**
 * Deletes a memory.
 */
export const removeMemoryHandler = async (
    ctx: ToolContext,
    input: RemoveMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await removeMemory(adapterResult.value, input.path);

    if (!result.ok()) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{ type: 'text', text: `Memory removed at ${input.path}` }],
    };
};
