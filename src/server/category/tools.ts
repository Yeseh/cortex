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
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import type { CategoryStorage } from '../../core/category/types.ts';
import type { CategoryIndex } from '../../core/index/types.ts';
import {
    createCategory,
    setDescription,
    deleteCategory,
    MAX_DESCRIPTION_LENGTH,
} from '../../core/category/index.ts';
import type { ServerConfig } from '../config.ts';
import { getMemoryPath } from '../config.ts';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Schema for required store name parameter */
const storeNameSchema = z.string().min(1, 'Store name is required');

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
            `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
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

/** Tool execution context containing server configuration */
interface ToolContext {
    /** Server configuration with default store and memory path */
    config: ServerConfig;
}

/** Standard MCP tool response with JSON text content */
interface McpToolResponse {
    [key: string]: unknown;
    /** Response content array with JSON-encoded result */
    content: { type: 'text'; text: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Resolves the store root directory from configuration.
 *
 * Optionally creates the store directory if it doesn't exist.
 *
 * @param config - Server configuration
 * @param storeName - Required store name
 * @param autoCreate - If true, creates the store directory if missing
 * @returns Result with the resolved store root path or MCP error
 */
const resolveStoreRoot = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<string, McpError>> => {
    const memoryPath = getMemoryPath(config);
    const storeRoot = resolve(memoryPath, storeName);

    if (autoCreate) {
        try {
            await mkdir(storeRoot, { recursive: true });
        } catch {
            return err(
                new McpError(
                    ErrorCode.InternalError,
                    `Failed to create store directory: ${storeName}`
                )
            );
        }
    }

    return ok(storeRoot);
};

/**
 * Creates a CategoryStoragePort adapter from a FilesystemStorageAdapter.
 *
 * This bridges the gap between the adapter's internal methods and the
 * port interface expected by category operations. The adapter pattern
 * allows the core category logic to remain storage-agnostic.
 *
 * @param storeRoot - Absolute path to the store root directory
 * @returns CategoryStoragePort implementation backed by filesystem
 */
const createCategoryStoragePort = (storeRoot: string): CategoryStorage => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

    return {
        categoryExists: (path: string) => adapter.categoryExists(path),
        readCategoryIndex: (path: string) => adapter.readCategoryIndexForPort(path),
        writeCategoryIndex: (path: string, index: CategoryIndex) =>
            adapter.writeCategoryIndexForPort(path, index),
        ensureCategoryDirectory: (path: string) => adapter.ensureCategoryDirectory(path),
        deleteCategoryDirectory: (path: string) => adapter.deleteCategoryDirectory(path),
        updateSubcategoryDescription: (
            parentPath: string,
            subcategoryPath: string,
            description: string | null
        ) => adapter.updateSubcategoryDescription(parentPath, subcategoryPath, description),
        removeSubcategoryEntry: (parentPath: string, subcategoryPath: string) =>
            adapter.removeSubcategoryEntry(parentPath, subcategoryPath),
    };
};

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
    ctx: ToolContext,
    input: CreateCategoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const port = createCategoryStoragePort(storeRoot.value);
    const result = await createCategory(port, input.path);

    if (!result.ok) {
        if (result.error.code === 'INVALID_PATH') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    created: result.value.created,
                }),
            },
        ],
    };
};

/**
 * Handles the cortex_set_category_description tool call.
 *
 * Sets or clears a description for a category. The category is
 * auto-created if it doesn't exist (MCP convenience behavior).
 * Descriptions are stored in the parent category's index for
 * efficient listing.
 *
 * Constraints:
 * - Root categories cannot have descriptions
 * - Descriptions are trimmed; empty strings clear the description
 * - Maximum length is 500 characters
 *
 * @param ctx - Tool context with server configuration
 * @param input - Validated input with store, path, and description
 * @returns MCP response with JSON containing path and final description
 * @throws McpError on validation failure or storage error
 *
 * @example
 * ```typescript
 * // Response for setting description
 * { "path": "project/cortex", "description": "Memory system core" }
 *
 * // Response for clearing description
 * { "path": "project/cortex", "description": null }
 * ```
 */
export const setCategoryDescriptionHandler = async (
    ctx: ToolContext,
    input: SetCategoryDescriptionInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const port = createCategoryStoragePort(storeRoot.value);

    // MCP convenience: auto-create category if it doesn't exist
    const createResult = await createCategory(port, input.path);
    if (!createResult.ok && createResult.error.code !== 'INVALID_PATH') {
        throw new McpError(ErrorCode.InternalError, createResult.error.message);
    }

    const result = await setDescription(port, input.path, input.description);

    if (!result.ok) {
        if (result.error.code === 'ROOT_CATEGORY_REJECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'DESCRIPTION_TOO_LONG') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    description: result.value.description,
                }),
            },
        ],
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
    ctx: ToolContext,
    input: DeleteCategoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const port = createCategoryStoragePort(storeRoot.value);
    const result = await deleteCategory(port, input.path);

    if (!result.ok) {
        if (result.error.code === 'ROOT_CATEGORY_REJECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    deleted: result.value.deleted,
                }),
            },
        ],
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
 * Each tool automatically handles input validation via Zod schemas
 * and converts domain errors to appropriate MCP error codes.
 *
 * @param server - MCP server instance to register tools with
 * @param config - Server configuration with store defaults
 *
 * @example
 * ```typescript
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { registerCategoryTools } from './tools.ts';
 *
 * const server = new McpServer({ name: 'cortex', version: '1.0.0' });
 * registerCategoryTools(server, config);
 * ```
 */
export const registerCategoryTools = (server: McpServer, config: ServerConfig): void => {
    const ctx: ToolContext = { config };

    server.tool(
        'cortex_create_category',
        'Create a category and its parent hierarchy',
        createCategoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(createCategoryInputSchema, input);
            return createCategoryHandler(ctx, parsed);
        }
    );

    server.tool(
        'cortex_set_category_description',
        'Set or clear a category description (auto-creates category)',
        setCategoryDescriptionInputSchema.shape,
        async (input) => {
            const parsed = parseInput(setCategoryDescriptionInputSchema, input);
            return setCategoryDescriptionHandler(ctx, parsed);
        }
    );

    server.tool(
        'cortex_delete_category',
        'Delete a category and all its contents recursively',
        deleteCategoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(deleteCategoryInputSchema, input);
            return deleteCategoryHandler(ctx, parsed);
        }
    );
};
