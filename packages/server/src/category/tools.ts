/**
 * MCP category tools for managing memory categories.
 *
 * This module provides MCP tools for AI agents to create, describe,
 * and delete categories within memory stores. Categories organize
 * memories into a hierarchical structure.
 *
 * Tools provided:
 * - `cortex_create_category` - Create a category with auto-creation of ancestors
 * - `cortex_set_category_description` - Set or clear category descriptions
 * - `cortex_delete_category` - Delete a category and all its contents
 *
 * @module server/category/tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CategoryModeContext } from '@yeseh/cortex-core/category';
import type { CategoryMode, ConfigCategories, ConfigCategory } from '@yeseh/cortex-core';
import { MAX_DESCRIPTION_LENGTH } from '@yeseh/cortex-core/category';
import { storeNameSchema } from '../store/tools.ts';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for category tool registration.
 *
 * Controls which category tools are registered and how they enforce
 * category mode restrictions. When provided to `registerCategoryTools`,
 * these options determine tool availability and permission enforcement.
 *
 * @module server/category/tools
 *
 * @example
 * ```typescript
 * // Free mode (default) - all tools available, no restrictions
 * const freeOptions: CategoryToolsOptions = {
 *     mode: 'free',
 * };
 *
 * // Subcategories mode - only subcategories of config-defined allowed
 * const subOptions: CategoryToolsOptions = {
 *     mode: 'subcategories',
 *     configCategories: {
 *         standards: { subcategories: { architecture: {} } },
 *         projects: {},
 *     },
 * };
 *
 * // Strict mode - create/delete tools not registered
 * const strictOptions: CategoryToolsOptions = {
 *     mode: 'strict',
 *     configCategories: {
 *         standards: {},
 *         projects: {},
 *     },
 * };
 * ```
 *
 * @see {@link registerCategoryTools} for usage in tool registration
 * @see {@link CategoryModeContext} for the context passed to handlers
 */
export interface CategoryToolsOptions {
    /**
     * Category creation/deletion mode for the store.
     *
     * - `free` (default) - Categories can be created/deleted freely
     * - `subcategories` - Only subcategories of config-defined categories allowed
     * - `strict` - Only config-defined categories allowed; create/delete tools not registered
     */
    mode?: CategoryMode;
    /**
     * Config-defined category hierarchy for protection checks.
     *
     * In `subcategories` or `strict` mode, this hierarchy determines which
     * categories are protected and which root categories are allowed.
     */
    configCategories?: ConfigCategories;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Schema for required category path parameter */
const categoryPathSchema = z.string().min(1, 'Category path is required');

/**
 * Input schema for the cortex_create_category tool.
 *
 * @example
 * ```json
 * {
 *   "store": "default",
 *   "path": "project/cortex"
 * }
 * ```
 */
export const createCategoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: categoryPathSchema.describe('Category path (e.g., "project/cortex")'),
});

/**
 * Input schema for the cortex_set_category_description tool.
 *
 * @example
 * ```json
 * {
 *   "store": "default",
 *   "path": "project/cortex",
 *   "description": "Memory system for AI agents"
 * }
 * ```
 */
export const setCategoryDescriptionInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: categoryPathSchema.describe('Category path (e.g., "project/cortex")'),
    description: z
        .string()
        .max(
            MAX_DESCRIPTION_LENGTH,
            `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
        )
        .describe('Category description (empty string to clear)'),
});

/**
 * Input schema for the cortex_delete_category tool.
 *
 * @example
 * ```json
 * {
 *   "store": "default",
 *   "path": "project/old-project"
 * }
 * ```
 */
export const deleteCategoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: categoryPathSchema.describe('Category path to delete'),
});

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

/** Input type for the createCategoryHandler */
export interface CreateCategoryInput {
    /** Store name (required) */
    store: string;
    /** Category path to create (e.g., "project/cortex") */
    path: string;
}

/** Input type for the setCategoryDescriptionHandler */
export interface SetCategoryDescriptionInput {
    /** Store name (required) */
    store: string;
    /** Category path to update (e.g., "project/cortex") */
    path: string;
    /** Description text (empty string to clear) */
    description: string;
}

/** Input type for the deleteCategoryHandler */
export interface DeleteCategoryInput {
    /** Store name (required) */
    store: string;
    /** Category path to delete (e.g., "project/old-project") */
    path: string;
}

/** Standard MCP tool response with JSON text content */
interface McpToolResponse {
    [key: string]: unknown;
    /** Response content array with JSON-encoded result */
    content: { type: 'text'; text: string }[];
}

/**
 * Parses and validates input against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param input - Raw input from MCP tool call
 * @returns Validated and typed input
 * @throws McpError with InvalidParams code if validation fails
 */
const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const message = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new McpError(ErrorCode.InvalidParams, message);
    }
    return result.data;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles the cortex_create_category tool call.
 *
 * Creates a category at the specified path, automatically creating any
 * missing intermediate ancestors. The operation is idempotent - creating
 * an existing category succeeds with `created: false`.
 *
 * @param ctx - Tool context with server configuration
 * @param input - Validated input with store and path
 * @param modeContext - Optional mode context for permission enforcement
 * @returns MCP response with JSON containing path and created flag
 * @throws McpError on validation failure or storage error
 *
 * @example
 * ```typescript
 * // Response for new category
 * { "path": "project/cortex", "created": true }
 *
 * // Response for existing category
 * { "path": "project/cortex", "created": false }
 * ```
 */
export const createCategoryHandler = async (
    ctx: CortexContext,
    input: CreateCategoryInput,
    modeContext?: CategoryModeContext,
): Promise<McpToolResponse> => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }

    // Access the adapter through the store client
    // The adapter is private, but we need it to pass modeContext to operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = (storeResult.value as any).adapter;
    const { createCategory } = await import('@yeseh/cortex-core/category');
    const result = await createCategory(adapter.categories, input.path, modeContext);

    if (!result.ok()) {
        if (result.error.code === 'INVALID_PATH') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'ROOT_CATEGORY_NOT_ALLOWED' || result.error.code === 'CATEGORY_PROTECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                path: result.value.path,
                created: result.value.created,
            }),
        }],
    };
};

/**
 * Handles the cortex_set_category_description tool call.
 *
 * Sets or clears a description for a category. The category is
 * auto-created if it doesn't exist (MCP convenience behavior).
 * Descriptions are stored in the parent category's index for
 * efficient listing. For root categories, descriptions are stored
 * in the store's root index file.
 *
 * Constraints:
 * - Descriptions are trimmed; empty strings clear the description
 * - Maximum length is 500 characters
 *
 * @param ctx - Tool context with server configuration
 * @param input - Validated input with store, path, and description
 * @param modeContext - Optional mode context for protection checks
 * @returns MCP response with JSON containing path and final description
 * @throws McpError on validation failure or storage error
 *
 * @example
 * ```typescript
 * // Response for setting description on subcategory
 * { "path": "project/cortex", "description": "Memory system core" }
 *
 * // Response for setting description on root category
 * { "path": "project", "description": "Project-related memories" }
 *
 * // Response for clearing description
 * { "path": "project/cortex", "description": null }
 * ```
 */
export const setCategoryDescriptionHandler = async (
    ctx: CortexContext,
    input: SetCategoryDescriptionInput,
    modeContext?: CategoryModeContext,
): Promise<McpToolResponse> => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }

    // Access the adapter through the store client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = (storeResult.value as any).adapter;
    const { createCategory, setDescription } = await import('@yeseh/cortex-core/category');

    // MCP convenience: auto-create category if it doesn't exist
    const createResult = await createCategory(adapter.categories, input.path, modeContext);
    if (!createResult.ok() && createResult.error.code !== 'INVALID_PATH') {
        if (createResult.error.code === 'ROOT_CATEGORY_NOT_ALLOWED' || createResult.error.code === 'CATEGORY_PROTECTED') {
            throw new McpError(ErrorCode.InvalidParams, createResult.error.message);
        }
        throw new McpError(ErrorCode.InternalError, createResult.error.message);
    }

    const result = await setDescription(
        adapter.categories,
        input.path,
        input.description,
        modeContext,
    );

    if (!result.ok()) {
        if (result.error.code === 'DESCRIPTION_TOO_LONG') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_PROTECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                path: result.value.path,
                description: result.value.description,
            }),
        }],
    };
};

/**
 * Handles the cortex_delete_category tool call.
 *
 * Deletes a category and all its contents recursively. This includes
 * all memories and subcategories within the target path. The operation
 * is NOT idempotent - attempting to delete a non-existent category
 * returns an error.
 *
 * Constraints:
 * - Root categories cannot be deleted
 * - Category must exist
 *
 * @param ctx - Tool context with server configuration
 * @param input - Validated input with store and path
 * @param modeContext - Optional mode context for protection checks
 * @returns MCP response with JSON containing path and deleted flag
 * @throws McpError on validation failure, missing category, or storage error
 *
 * @example
 * ```typescript
 * // Response for successful deletion
 * { "path": "project/old-project", "deleted": true }
 * ```
 */
export const deleteCategoryHandler = async (
    ctx: CortexContext,
    input: DeleteCategoryInput,
    modeContext?: CategoryModeContext,
): Promise<McpToolResponse> => {
    const storeResult = ctx.cortex.getStore(input.store);
    if (!storeResult.ok()) {
        throw new McpError(ErrorCode.InvalidParams, storeResult.error.message);
    }

    // Access the adapter through the store client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = (storeResult.value as any).adapter;
    const { deleteCategory } = await import('@yeseh/cortex-core/category');
    const result = await deleteCategory(adapter.categories, input.path, modeContext);

    if (!result.ok()) {
        if (result.error.code === 'ROOT_CATEGORY_REJECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_PROTECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                path: result.value.path,
                deleted: result.value.deleted,
            }),
        }],
    };
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers all category tools with the MCP server.
 *
 * This function registers the following tools:
 * - `cortex_create_category` - Create categories with auto-ancestor creation
 * - `cortex_set_category_description` - Set or clear category descriptions
 * - `cortex_delete_category` - Delete categories recursively
 *
 * Tool registration is affected by the category mode:
 * - `free` mode (default): All tools registered
 * - `subcategories` mode: All tools registered with mode enforcement
 * - `strict` mode: create/delete tools NOT registered
 *
 * Each tool automatically handles input validation via Zod schemas
 * and converts domain errors to appropriate MCP error codes.
 *
 * @param server - MCP server instance to register tools with
 * @param ctx - Tool context with config and cortex instance
 * @param categoryConfig - Optional configuration for mode enforcement
 *
 * @example
 * ```typescript
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { registerCategoryTools } from './tools.ts';
 *
 * const server = new McpServer({ name: 'cortex', version: '1.0.0' });
 * const ctx: CortexContext = { config, cortex };
 *
 * // Free mode (default)
 * registerCategoryTools(server, ctx);
 *
 * // Strict mode - create/delete tools not registered
 * registerCategoryTools(server, ctx, { mode: 'strict' });
 * ```
 */
export const registerCategoryTools = (
    server: McpServer,
    ctx: CortexContext,
    categoryConfig?: CategoryToolsOptions,
): void => {
    const mode = categoryConfig?.mode ?? 'free';
    const modeContext: CategoryModeContext | undefined = categoryConfig ? {
        mode,
        configCategories: categoryConfig.configCategories,
    } : undefined;

    // In strict mode, don't register create/delete tools
    if (mode !== 'strict') {
        server.tool(
            'cortex_create_category',
            'Create a category and its parent hierarchy',
            createCategoryInputSchema.shape,
            async (input) => {
                const parsed = parseInput(createCategoryInputSchema, input);
                return createCategoryHandler(ctx, parsed, modeContext);
            },
        );

        server.tool(
            'cortex_delete_category',
            'Delete a category and all its contents recursively',
            deleteCategoryInputSchema.shape,
            async (input) => {
                const parsed = parseInput(deleteCategoryInputSchema, input);
                return deleteCategoryHandler(ctx, parsed, modeContext);
            },
        );
    }

    // set_category_description is always registered but enforces protection
    server.tool(
        'cortex_set_category_description',
        'Set or clear a category description (auto-creates category)',
        setCategoryDescriptionInputSchema.shape,
        async (input) => {
            const parsed = parseInput(setCategoryDescriptionInputSchema, input);
            return setCategoryDescriptionHandler(ctx, parsed, modeContext);
        },
    );
};
