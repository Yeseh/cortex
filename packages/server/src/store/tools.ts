/**
 * Store listing utilities and validation schemas for MCP tools.
 *
 * This module provides:
 * - Functions for listing stores from filesystem or registry
 * - Validation schemas for store names and tool inputs
 * - Types for store information and listing results
 * - Handler functions for MCP tools
 *
 * Store creation is handled by {@link @yeseh/cortex-core/store#initializeStore}
 * in the tool registration layer, keeping this module focused on read operations.
 *
 * @module server/store/tools
 */

import * as fs from 'node:fs/promises';
import { z } from 'zod';
import { err, ok, type Result } from '@yeseh/cortex-core';
import type { CategoryMode, CortexContext, StoreData } from '@yeseh/cortex-core';
import { convertToCategories, type CategoryInfo } from './shared.ts';
import { errorResponse, textResponse, type McpToolResponse } from '../response.ts';
import { resolve } from 'node:path';

/**
 * Error codes for store tool operations.
 *
 * - `STORE_LIST_FAILED` - Could not read the data directory
 */
export type StoreToolErrorCode = 'STORE_LIST_FAILED';

/**
 * Error details for store tool failures.
 */
export interface StoreToolError {
    /** Error classification code */
    code: StoreToolErrorCode;
    /** Human-readable error description */
    message: string;
    /** Original error that caused the failure */
    cause?: unknown;
}

/**
 * Schema for validating store names.
 *
 * Store names must:
 * - Start with an alphanumeric character
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Be non-empty
 */
export const storeNameSchema = z
    .string()
    .min(1, 'Store name must not be empty')
    .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
        'Store name must start with alphanumeric and contain only alphanumeric, hyphens, or underscores'
    );

/**
 * Input schema for the create_store tool.
 */
export const createStoreInputSchema = z.object({
    name: storeNameSchema,
});

/** Type for create_store input */
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

/**
 * Information about a single store.
 */
export interface StoreInfo {
    /** Name of the store */
    name: string;
    /** Path to the store directory */
    path: string;
    /** Optional description of the store */
    description?: string;
    /** Category creation/deletion mode */
    categoryMode: CategoryMode;
    /** Config-defined category hierarchy */
    categories: CategoryInfo[];
}

/**
 * Result of listing stores from the registry.
 */
export interface ListStoresResult {
    /** List of stores with their metadata */
    stores: StoreInfo[];
}

/**
 * Lists all available memory stores in the data directory.
 *
 * Reads the data path directory and returns all subdirectory names
 * as store names. If the data path doesn't exist yet, returns an
 * empty array (stores will be created on first use).
 *
 * @param dataPath - Directory where stores are persisted
 * @returns Result with list of store names or error
 *
 * @example
 * ```ts
 * const result = await listStores('./.cortex-data');
 * if (result.ok()) {
 *   console.log('Stores:', result.value); // ['default', 'project-a']
 * }
 * ```
 */
export const listStores = async (dataPath: string): Promise<Result<string[], StoreToolError>> => {
    try {
        const entries = await fs.readdir(dataPath, { withFileTypes: true });
        const stores = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        return ok(stores);
    } catch (error) {
        // Handle ENOENT (data path doesn't exist yet) by returning empty array
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return ok([]);
        }
        return err({
            code: 'STORE_LIST_FAILED',
            message: `Failed to list stores: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        });
    }
};

/**
 * Lists all stores from the context registry with their metadata.
 *
 * Returns all registered stores with their names, paths, and optional
 * descriptions from the CortexContext stores configuration.
 *
 * @param ctx - Tool context containing cortex instance
 * @returns Result with list of stores or error
 *
 * @example
 * ```ts
 * const result = await listStoresFromContext(ctx);
 * if (result.ok()) {
 *   console.log('Stores:', result.value.stores);
 *   // [{ name: 'default', path: '/path/to/default', description: 'Default store' }]
 * }
 * ```
 */
export const listStoresFromContext = (
    ctx: CortexContext
): Result<ListStoresResult, StoreToolError> => {
    try {
        const stores: StoreInfo[] = Object.entries(ctx.stores)
            .map(([name, definition]) => ({
                name,
                path: (definition.properties as { path: string }).path,
                ...(definition.description !== undefined && {
                    description: definition.description,
                }),
                categoryMode: definition.categoryMode ?? 'free',
                categories: convertToCategories(definition.categories),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return ok({ stores });
    } catch (error) {
        return err({
            code: 'STORE_LIST_FAILED',
            message: `Failed to list stores: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        });
    }
};

// ---------------------------------------------------------------------------
// Tool response types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/**
 * Handler for the cortex_list_stores MCP tool.
 *
 * Lists all available memory stores from the registry.
 *
 * @param ctx - Tool context containing config and cortex instance
 * @returns MCP tool response with list of stores or error
 *
 * @example
 * ```ts
 * const result = await listStoresHandler(ctx);
 * // { content: [{ type: 'text', text: '{"stores":[...]}' }] }
 * ```
 */
export const listStoresHandler = async (ctx: CortexContext): Promise<McpToolResponse> => {
    const stores: StoreInfo[] = Object.entries(ctx.stores)
        .map(([name, definition]) => ({
            name,
            path: (definition.properties as { path: string }).path,
            ...(definition.description !== undefined && {
                description: definition.description,
            }),
            categoryMode: definition.categoryMode ?? 'free',
            categories: convertToCategories(definition.categories),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return textResponse(JSON.stringify({ stores }, null, 2));
};

/**
 * Handler for the cortex_create_store MCP tool.
 *
 * Creates a new memory store with the given name.
 *
 * @param ctx - Tool context containing config and cortex instance
 * @param input - Input containing the store name to create
 * @returns MCP tool response with created store info or error
 *
 * @example
 * ```ts
 * const result = await createStoreHandler(ctx, { name: 'my-store' });
 * // { content: [{ type: 'text', text: '{"created":"my-store"}' }] }
 * ```
 */
export const createStoreHandler = async (
    ctx: CortexContext,
    input: CreateStoreInput
): Promise<McpToolResponse> => {
    // Validate input
    const validation = createStoreInputSchema.safeParse(input);
    if (!validation.success) {
        return errorResponse(
            `Store name is invalid: ${validation.error.issues.map((issue) => issue.message).join('\n')}`
        );
    }

    // Check if store already exists in registry
    if (ctx.stores[input.name]) {
        return errorResponse(`Store '${input.name}' already exists. Choose a different name.`);
    }

    const storeClient = ctx.cortex.getStore(input.name);
    if (!storeClient.ok()) {
        return errorResponse(
            'Failed to create store client for default store. Please check server configuration. Message: ' +
                storeClient.error.message
        );
    }

    if (!ctx.globalDataPath) {
        return errorResponse(
            'Server configuration error: globalDataPath is not defined in context.'
        );
    }

    // TODO: Coupled on fs implementation
    const storePath = resolve(ctx.globalDataPath, input.name);
    const storeData: StoreData = {
        kind: 'filesystem',
        categoryMode: 'free',
        categories: [], // No pre-defined categories for new stores, but could add templates in the future
        properties: {
            path: storePath,
        },
    };

    const store = storeClient.value;
    const initializeResult = await store.initialize(storeData);
    if (!initializeResult.ok()) {
        return errorResponse(`Failed to initialize store: ${initializeResult.error.message}`);
    }

    // Create the store directory
    try {
        await fs.mkdir(storePath, { recursive: true });
    } catch (error) {
        return errorResponse(
            `Failed to create store directory: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Register the new store in the context so subsequent operations can find it
    ctx.stores[input.name] = {
        kind: storeData.kind,
        categoryMode: storeData.categoryMode,
        categories: {},
        properties: storeData.properties,
    };

    return textResponse(JSON.stringify({ created: input.name }, null, 2));
};
