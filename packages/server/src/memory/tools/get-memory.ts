/**
 * Get memory MCP tool.
 *
 * @module server/memory/tools/get-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { memoryPathSchema, translateMemoryError } from './shared.ts';
import { type McpToolResponse, textResponse } from '../../response.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

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
    ctx: CortexContext,
    input: GetMemoryInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_get_memory', input.store, async () => {
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }
        const store = storeResult.value;

        const memoryClient = store.getMemory(input.path);
        const result = await memoryClient.get({
            includeExpired: input.include_expired ?? false,
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

        return textResponse(JSON.stringify(output, null, 2));
    });
};
