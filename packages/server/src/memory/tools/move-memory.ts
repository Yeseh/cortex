/**
 * Move memory MCP tool.
 *
 * @module server/memory/tools/move-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { type McpToolResponse, textResponse } from '../../response.ts';
import { memoryPathSchema, translateMemoryError } from './shared.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

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
    ctx: CortexContext,
    input: MoveMemoryInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_move_memory', input.store, async () => {
        ctx.logger?.debug('cortex_move_memory invoked', { store: input.store, from_path: input.from_path, to_path: input.to_path });
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            ctx.logger?.debug('cortex_move_memory failed', { store: input.store, error_code: storeResult.error.code });
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }
        const store = storeResult.value;

        const sourceMemory = store.getMemory(input.from_path);
        const destMemory = store.getMemory(input.to_path);
        const result = await sourceMemory.move(destMemory);

        if (!result.ok()) {
            ctx.logger?.debug('cortex_move_memory failed', { store: input.store, from_path: input.from_path, error_code: result.error.code });
            throw translateMemoryError(result.error);
        }

        ctx.logger?.debug('cortex_move_memory succeeded', { store: input.store, from_path: input.from_path, to_path: input.to_path });
        return textResponse(`Memory moved from ${input.from_path} to ${input.to_path}`);
    });
};
