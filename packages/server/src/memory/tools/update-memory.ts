/**
 * Update memory MCP tool.
 *
 * @module server/memory/tools/update-memory
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { updateMemory } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    isoDateSchema,
    memoryPathSchema,
    tagsSchema,
    type ToolContext,
    type McpToolResponse,
    resolveStoreAdapter,
    translateMemoryError,
} from './shared.ts';

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
            'New expiration date (ISO 8601). Pass null to clear the expiration. Omit to keep existing value.'
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
    ctx: ToolContext,
    input: UpdateMemoryInput
): Promise<McpToolResponse> => {
    // Validate that at least one update field is provided
    if (
        input.content === undefined &&
        input.tags === undefined &&
        input.expires_at === undefined &&
        input.citations === undefined
    ) {
        throw new McpError(
            ErrorCode.InvalidParams,
            'No updates provided. Specify content, tags, expires_at, or citations.'
        );
    }

    const adapterResult = await resolveStoreAdapter(ctx, input.store);
    if (!adapterResult.ok()) {
        throw adapterResult.error;
    }

    const result = await updateMemory(adapterResult.value, input.path, {
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
        throw translateMemoryError(result.error);
    }

    return {
        content: [{ type: 'text', text: `Memory updated at ${input.path}` }],
    };
};
