/**
 * Update memory MCP tool.
 *
 * @module server/memory/tools/update-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { isoDateSchema, memoryPathSchema, tagsSchema, translateMemoryError } from './shared.ts';
import { type McpToolResponse } from '../../response.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

/** Schema for update_memory tool input */
export const updateMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().optional().describe('New memory content'),
    tags: tagsSchema.describe('New tags (replaces existing)'),
    expires_at: isoDateSchema
        .optional()
        .nullable()
        .describe(
            'New expiration date (ISO 8601). Pass null to clear the expiration. Omit to keep existing value.',
        ),
    citations: z
        .array(z.string().min(1))
        .optional()
        .describe('New citations (replaces existing). Omit to keep existing citations.'),
});

/**
 * Input type for the update_memory MCP tool.
 *
 * All fields except `store` and `path` are optional. Only provided fields
 * are updated; omitted fields retain their existing values.
 *
 * @example
 * ```typescript
 * // Update content and add new citations (replaces existing citations)
 * const input: UpdateMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     content: 'Updated: We now use semantic versioning headers.',
 *     citations: ['docs/api-spec-v2.md'],
 * };
 *
 * // Clear expiration while keeping everything else
 * const clearExpiry: UpdateMemoryInput = {
 *     store: 'cortex',
 *     path: 'decisions/api-versioning',
 *     expires_at: null,
 * };
 * ```
 */
export interface UpdateMemoryInput {
    /** Name of the memory store */
    store: string;
    /** Memory path in category/slug format */
    path: string;
    /** New content (omit to keep existing) */
    content?: string;
    /** New tags - replaces existing tags when provided */
    tags?: string[];
    /**
     * New expiration date.
     * - ISO 8601 string — set expiration to this date
     * - `null` — explicitly clear (remove) the expiration
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expires_at?: string | null;
    /**
     * New citations - replaces existing citations when provided.
     *
     * **Update semantics:** When provided, completely replaces the existing
     * citations array. When omitted, existing citations are preserved.
     * To clear all citations, pass an empty array `[]`.
     */
    citations?: string[];
}

/**
 * Updates memory content or metadata.
 */
export const updateMemoryHandler = async (
    ctx: CortexContext,
    input: UpdateMemoryInput,
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_update_memory', input.store, async () => {
        ctx.logger?.debug('cortex_update_memory invoked', { store: input.store, path: input.path });
        // Validate that at least one update field is provided
        if (
            input.content === undefined &&
            input.tags === undefined &&
            input.expires_at === undefined &&
            input.citations === undefined
        ) {
            ctx.logger?.debug('cortex_update_memory failed', {
                store: input.store,
                path: input.path,
                error_code: 'NO_UPDATES_PROVIDED',
            });
            throw new McpError(
                ErrorCode.InvalidParams,
                'No updates provided. Specify content, tags, expires_at, or citations.',
            );
        }

        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            ctx.logger?.debug('cortex_update_memory failed', { store: input.store, path: input.path, error_code: storeResult.error.code });
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }
        const store = storeResult.value;

        const memoryClient = store.getMemory(input.path);
        const result = await memoryClient.update({
            content: input.content,
            tags: input.tags,
            expiresAt:
                input.expires_at === null
                    ? null
                    : input.expires_at
                        ? new Date(input.expires_at)
                        : undefined,
            citations: input.citations,
        });

        if (!result.ok()) {
            const translatedError = translateMemoryError(result.error);
            if (translatedError.code === ErrorCode.InternalError) {
                ctx.logger?.error('cortex_update_memory failed', undefined, {
                    store: input.store,
                    path: input.path,
                    error_code: result.error.code,
                });
            } else {
                ctx.logger?.debug('cortex_update_memory failed', {
                    store: input.store,
                    path: input.path,
                    error_code: result.error.code,
                });
            }
            throw translatedError;
        }

        const memory = result.value;
        ctx.logger?.debug('cortex_update_memory succeeded', { store: input.store, path: memory.path });
        return {
            content: [{ type: 'text', text: `Memory updated at ${memory.path}` }],
        };
    });
};
