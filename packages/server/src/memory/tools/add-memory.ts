/**
 * Add memory MCP tool.
 *
 * @module server/memory/tools/add-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { textResponse, type McpToolResponse } from '../../response.ts';
import {
    isoDateSchema,
    memoryPathSchema,
    tagsSchema,
    translateMemoryError,
} from './shared.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

/** Schema for add_memory tool input */
export const addMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().min(1, 'Content is required').describe('Memory content'),
    tags: tagsSchema.describe('Optional tags for categorization'),
    expires_at: isoDateSchema.optional().describe('Optional expiration date (ISO 8601)'),
    citations: z.array(z.string().min(1)).optional().describe(
        'Optional citations referencing source material (file paths, URLs, document identifiers)',
    ),
});

/**
 * Input type for the add_memory MCP tool.
 *
 * @example
 * ```typescript
 * const input: AddMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     content: 'We decided to use URL path versioning for the API.',
 *     tags: ['api', 'versioning'],
 *     citations: [
 *         'docs/api-spec.md',
 *         'https://github.com/org/repo/discussions/42',
 *     ],
 * };
 * ```
 */
export interface AddMemoryInput {
    /** Name of the memory store */
    store: string;
    /** Memory path in category/slug format (e.g., "decisions/api-versioning") */
    path: string;
    /** Memory content (markdown supported) */
    content: string;
    /** Optional tags for categorization and discovery */
    tags?: string[];
    /** Optional expiration date as ISO 8601 string */
    expires_at?: string;
    /**
     * Optional citations referencing source material.
     *
     * Each citation must be a non-empty string representing a file path,
     * URL, or document identifier.
     */
    citations?: string[];
}

/**
 * Creates a new memory with auto-creation of stores and categories.
 */
export const addMemoryHandler = async (
    ctx: CortexContext,
    input: AddMemoryInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_add_memory', input.store, async () => {
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }

        const store = storeResult.value;
        const memoryClient = store.getMemory(input.path);
        const timestamp = new Date();

        const result = await memoryClient.create({
            content: input.content,
            metadata: {
                tags: input.tags ?? [],
                source: 'mcp',
                createdAt: timestamp,
                updatedAt: timestamp,
                expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
                citations: input.citations ?? [],
            },
        });

        if (!result.ok()) {
            throw translateMemoryError(result.error);
        }

        const memory = result.value;

        return textResponse(`Memory created at ${memory.path}`);
    });
};
