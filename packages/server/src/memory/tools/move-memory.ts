/**
 * Move memory MCP tool.
 *
 * @module server/memory/tools/move-memory
 */

import { z } from 'zod';
import { moveMemory } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    memoryPathSchema,
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
    translateMemoryError,
} from './shared.ts';

/** Schema for move_memory tool input */
export const moveMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    from_path: memoryPathSchema.describe('Source memory path'),
    to_path: memoryPathSchema.describe('Destination memory path'),
});

/** Input type for move_memory tool */
export interface MoveMemoryInput {
    store: string;
    from_path: string;
    to_path: string;
}

/**
 * Moves or renames a memory.
 */
export const moveMemoryHandler = async (
    ctx: ToolContext,
    input: MoveMemoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = resolveStoreAdapter(ctx, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await moveMemory(adapterResult.value, input.from_path, input.to_path);

    if (!result.ok()) {
        throw translateMemoryError(result.error);
    }

    return {
        content: [{
            type: 'text',
            text: `Memory moved from ${input.from_path} to ${input.to_path}`,
        }],
    };
};
