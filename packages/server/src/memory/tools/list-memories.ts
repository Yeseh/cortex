/**
 * List memories MCP tool.
 *
 * @module server/memory/tools/list-memories
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CategoryError } from '@yeseh/cortex-core';
import { storeNameSchema } from '../../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import {
    textResponse,
    type McpToolResponse,
} from '../../response.ts';

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
 * Lists memories in a category.
 */
export const listMemoriesHandler = async (
    ctx: CortexContext,
    input: ListMemoriesInput,
): Promise<McpToolResponse> => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }

    const store = storeResult.value;
    const categoryResult = input.category 
        ? store.getCategory(input.category)
        : store.root();
    
    if (!categoryResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, categoryResult.error.message);
    }

    const category = categoryResult.value;
    const memoriesResult = await category.listMemories({
        includeExpired: input.includeExpired ?? false,
    });

    if (!memoriesResult.ok()) {
        throw translateCategoryError(memoriesResult.error);
    }

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
            tokenEstimate: m.tokenEstimate,
            updatedAt: m.updatedAt?.toISOString(),
        })),
        subcategories: subcategories.map((s) => ({
            path: s.path.toString(),
            memoryCount: s.memoryCount,
            description: s.description,
        })),
    };

    return textResponse(JSON.stringify(output, null, 2));
};
