/**
 * List memories MCP tool.
 *
 * @module server/memory/tools/list-memories
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CategoryError, CategoryClient } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { textResponse, type McpToolResponse } from '../../response.ts';
import { withSpan } from '../../tracing.ts';
import { tracer } from '../../observability.ts';

/** Schema for list_memories tool input */
export const listMemoriesInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    category: z
        .string()
        .optional()
        .describe('Category path to list (lists root categories if omitted)'),
    include_expired: z.boolean().optional().default(false).describe('Include expired memories'),
});

/** Input type for list_memories tool */
export interface ListMemoriesInput {
    store: string;
    category?: string;
    includeExpired?: boolean;
}

/**
 * Translates a CategoryError to an MCP McpError.
 */
const translateCategoryError = (error: CategoryError): McpError => {
    switch (error.code) {
        case 'CATEGORY_NOT_FOUND':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'INVALID_PATH':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'ROOT_CATEGORY_REJECTED':
        case 'ROOT_CATEGORY_NOT_ALLOWED':
        case 'CATEGORY_PROTECTED':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'DESCRIPTION_TOO_LONG':
            return new McpError(ErrorCode.InvalidParams, error.message);
        case 'STORAGE_ERROR':
            return new McpError(ErrorCode.InternalError, error.message);
        default:
            return new McpError(ErrorCode.InternalError, `Unknown error: ${error.message}`);
    }
};

/**
 * Collects memory entries from a category, optionally recursing into
 * subcategories and filtering out expired memories.
 *
 * @param root - The root CategoryClient for resolving subcategory paths
 * @param client - The current category client to collect from
 * @param includeExpired - Whether to include expired memories
 * @param now - Current time for expiration checks
 * @param visited - Set of visited category paths to prevent cycles
 * @returns Array of memory entry objects with path, token_estimate, and updated_at
 */
const collectMemories = async (
    root: CategoryClient,
    client: CategoryClient,
    includeExpired: boolean,
    now: Date,
    visited: Set<string> = new Set()
): Promise<{ path: string; token_estimate: number; updated_at?: string }[]> => {
    const key = client.rawPath;
    if (visited.has(key)) return [];
    visited.add(key);

    const memoriesResult = await client.listMemories({ includeExpired: true });
    if (!memoriesResult.ok()) {
        throw translateCategoryError(memoriesResult.error);
    }

    const entries: { path: string; token_estimate: number; updated_at?: string }[] = [];

    for (const m of memoriesResult.value) {
        // When filtering expired, load each memory to check expiration
        if (!includeExpired) {
            const memoryClient = client.getMemory(m.path.slug.toString());
            const memoryResult = await memoryClient.get({ includeExpired: true, now });
            if (!memoryResult.ok()) {
                continue; // Skip memories that can't be loaded
            }
            if (memoryResult.value.isExpired(now)) {
                continue; // Skip expired memories
            }
        }

        entries.push({
            path: m.path.toString(),
            token_estimate: m.tokenEstimate,
            updated_at: m.updatedAt?.toISOString(),
        });
    }

    // Recurse into subcategories
    const subcategoriesResult = await client.listSubcategories();
    if (!subcategoriesResult.ok()) {
        throw translateCategoryError(subcategoriesResult.error);
    }

    for (const sub of subcategoriesResult.value) {
        const subResult = root.getCategory(sub.path.toString());
        if (!subResult.ok()) continue;
        const subMemories = await collectMemories(
            root,
            subResult.value,
            includeExpired,
            now,
            visited
        );
        entries.push(...subMemories);
    }

    return entries;
};

/**
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: CortexContext,
    input: ListMemoriesInput
): Promise<McpToolResponse> => {
    return withSpan(tracer, 'cortex_list_memories', input.store, async () => {
        const storeResult = ctx.cortex.getStore(input.store);
        if (!storeResult.ok()) {
            throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
        }

        const store = storeResult.value;
        const rootResult = store.root();
        if (!rootResult.ok()) {
            throw new McpError(ErrorCode.InvalidParams, rootResult.error.message);
        }

        const root = rootResult.value;
        const includeExpired = input.includeExpired ?? false;
        const now = ctx.now ? ctx.now() : new Date();

        // Resolve the target category
        let category: CategoryClient;
        if (input.category) {
            const categoryResult = root.getCategory(input.category);
            if (!categoryResult.ok()) {
                throw new McpError(ErrorCode.InvalidParams, categoryResult.error.message);
            }
            category = categoryResult.value;
        } else {
            category = root;
        }

        // Collect memories (recursing into subcategories when listing from root)
        const memories = input.category
            ? await collectMemories(root, category, includeExpired, now)
            : await collectMemories(root, category, includeExpired, now);

        const subcategoriesResult = await category.listSubcategories();
        if (!subcategoriesResult.ok()) {
            throw translateCategoryError(subcategoriesResult.error);
        }

        const subcategories = subcategoriesResult.value;

        const output = {
            category: input.category ?? 'all',
            count: memories.length,
            memories,
            subcategories: subcategories.map((s) => ({
                path: s.path.toString(),
                memory_count: s.memoryCount,
                description: s.description,
            })),
        };

        return textResponse(JSON.stringify(output, null, 2));
    });
};
