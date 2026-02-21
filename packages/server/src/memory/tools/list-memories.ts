/**
 * List memories MCP tool.
 *
 * @module server/memory/tools/list-memories
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CategoryError } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import {
    type ToolContext,
    type McpToolResponse,
} from './shared.ts';

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
    include_expired?: boolean;
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
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: ToolContext,
    input: ListMemoriesInput,
): Promise<McpToolResponse> => {
    // Get store using fluent API
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }
    const store = storeResult.value;

    // Get category client (root or specific category)
    const categoryResult = input.category 
        ? store.getCategory(input.category)
        : store.root();
    
    if (!categoryResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, categoryResult.error.message);
    }
    const category = categoryResult.value;

    // List memories in the category
    const memoriesResult = await category.listMemories({
        includeExpired: input.include_expired ?? false,
    });

    if (!memoriesResult.ok()) {
        throw translateCategoryError(memoriesResult.error);
    }

    // List subcategories in the category
    const subcategoriesResult = await category.listSubcategories();
    if (!subcategoriesResult.ok()) {
        throw translateCategoryError(subcategoriesResult.error);
    }

    const memories = memoriesResult.value;
    const subcategories = subcategoriesResult.value;

    const output = {
        category: input.category ?? 'root',
        count: memories.length,
        memories: memories.map((m) => ({
            path: m.path.toString(),
            token_estimate: m.tokenEstimate,
            summary: undefined, // CategoryMemoryEntry doesn't have summary
            expires_at: undefined, // CategoryMemoryEntry doesn't track expiration
            is_expired: undefined, // CategoryMemoryEntry doesn't track expiration
            updated_at: m.updatedAt?.toISOString(),
        })),
        subcategories: subcategories.map((s) => ({
            path: s.path.toString(),
            memory_count: s.memoryCount,
            description: s.description,
        })),
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    };
};
