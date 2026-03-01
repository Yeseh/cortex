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
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

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
    return withSpan(tracer, 'cortex_remove_memory', input.store, async () => {
        ctx.logger?.debug('cortex_remove_memory invoked', { store: input.store, path: input.path });
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            ctx.logger?.debug('cortex_remove_memory failed', { store: input.store, error_code: storeResult.error.code });
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }
        const store = storeResult.value;

        const memoryClient = store.getMemory(input.path);
        const result = await memoryClient.delete();

        if (!result.ok()) {
            ctx.logger?.error('cortex_remove_memory failed', undefined, { store: input.store, path: input.path, error_code: result.error.code });
            throw new McpError(ErrorCode.InternalError, result.error.message);
        }

        ctx.logger?.debug('cortex_remove_memory succeeded', { store: input.store, path: input.path });
        return textResponse(`Memory removed at ${input.path}`);
    });
};
