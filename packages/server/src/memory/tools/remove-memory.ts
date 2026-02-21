/**
 * Remove memory MCP tool.
 *
 * @module server/memory/tools/remove-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { type McpToolResponse, textResponse } from '../../response.ts';
import { memoryPathSchema } from './shared.ts';

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
    ctx: CortexContext,
    input: RemoveMemoryInput,
): Promise<McpToolResponse> => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }
    const store = storeResult.value;

    const memoryClient = store.getMemory(input.path);
    const result = await memoryClient.delete();

    if (!result.ok()) {
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return textResponse(`Memory removed at ${input.path}`);
};
