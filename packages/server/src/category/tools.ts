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
import { join } from 'node:path';
import type { Result } from '@yeseh/cortex-core';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import type { CategoryStoragePort } from '@yeseh/cortex-core/category';
import {
    createCategory,
    setDescription,
    deleteCategory,
    MAX_DESCRIPTION_LENGTH,
} from '@yeseh/cortex-core/category';
import type { ServerConfig } from '../config.ts';
import { storeNameSchema } from '../store/tools.ts';

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
 * Resolves the store adapter from the registry.
 *
 * Loads the registry, resolves the store, and returns a scoped storage adapter.
 * For operations that require auto-creation (like createCategory), the adapter
 * is returned even if the store directory doesn't exist yet.
 *
 * @param config - Server configuration
 * @param storeName - Required store name
 * @returns Result with the ScopedStorageAdapter or MCP error
 */
const resolveStoreAdapter = async (
    config: ServerConfig,
    storeName: string,
): Promise<Result<ScopedStorageAdapter, McpError>> => {
    const registryPath = join(config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();

    if (!registryResult.ok) {
        // Map REGISTRY_MISSING to appropriate error
        if (registryResult.error.code === 'REGISTRY_MISSING') {
            return err(
                new McpError(ErrorCode.InternalError, `Store registry not found at ${registryPath}`),
            );
        }
        return err(
            new McpError(
                ErrorCode.InternalError,
                `Failed to load store registry: ${registryResult.error.message}`,
            ),
        );
    }

    const storeResult = registry.getStore(storeName);
    if (!storeResult.ok) {
        return err(new McpError(ErrorCode.InvalidParams, storeResult.error.message));
    }

    return ok(storeResult.value);
};

/**
 * Creates a CategoryStorage adapter from a ScopedStorageAdapter.
 *
 * The ScopedStorageAdapter already provides a categories interface that
 * implements CategoryStorage, so this simply returns that interface.
 *
 * @param adapter - Scoped storage adapter from registry.getStore()
 * @returns CategoryStorage implementation
 */
const createCategoryStoragePort = (adapter: ScopedStorageAdapter): CategoryStoragePort => {
    return adapter.categories;
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
    input: CreateCategoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const port = createCategoryStoragePort(adapterResult.value);
    const result = await createCategory(port, input.path);

    if (!result.ok) {
        if (result.error.code === 'INVALID_PATH') {
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
    ctx: ToolContext,
    input: SetCategoryDescriptionInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const port = createCategoryStoragePort(adapterResult.value);

    // MCP convenience: auto-create category if it doesn't exist
    const createResult = await createCategory(port, input.path);
    if (!createResult.ok && createResult.error.code !== 'INVALID_PATH') {
        throw new McpError(ErrorCode.InternalError, createResult.error.message);
    }

    const result = await setDescription(port, input.path, input.description);

    if (!result.ok) {
        if (result.error.code === 'DESCRIPTION_TOO_LONG') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
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
    input: DeleteCategoryInput,
): Promise<McpToolResponse> => {
    const adapterResult = await resolveStoreAdapter(ctx.config, input.store);
    if (!adapterResult.ok) {
        throw adapterResult.error;
    }

    const port = createCategoryStoragePort(adapterResult.value);
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
        },
    );

    server.tool(
        'cortex_set_category_description',
        'Set or clear a category description (auto-creates category)',
        setCategoryDescriptionInputSchema.shape,
        async (input) => {
            const parsed = parseInput(setCategoryDescriptionInputSchema, input);
            return setCategoryDescriptionHandler(ctx, parsed);
        },
    );

    server.tool(
        'cortex_delete_category',
        'Delete a category and all its contents recursively',
        deleteCategoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(deleteCategoryInputSchema, input);
            return deleteCategoryHandler(ctx, parsed);
        },
    );
};
