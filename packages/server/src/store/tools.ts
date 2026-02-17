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
import * as path from 'node:path';
import { z } from 'zod';
import { err, ok, type Result } from '@yeseh/cortex-core';
import { initializeStore } from '@yeseh/cortex-core/store';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import type { ToolContext } from '../memory/tools/shared.ts';

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
    .min(
        1, 'Store name must not be empty',
    )
    .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
        'Store name must start with alphanumeric and contain only alphanumeric, hyphens, or underscores',
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
export const listStores = async (dataPath: string)
: Promise<Result<string[], StoreToolError>> => {
    try {
        const entries = await fs.readdir(
            dataPath, { withFileTypes: true },
        );
        const stores = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        return ok(stores);
    }
    catch (error) {
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
 * Lists all stores from the registry with their metadata.
 *
 * Reads the store registry file and returns all registered stores
 * with their names, paths, and optional descriptions. If the registry
 * doesn't exist yet, returns an empty list.
 *
 * @param registryPath - Path to the stores.yaml registry file
 * @returns Result with list of stores or error
 *
 * @example
 * ```ts
 * const result = await listStoresFromRegistry('/path/to/stores.yaml');
 * if (result.ok()) {
 *   console.log('Stores:', result.value.stores);
 *   // [{ name: 'default', path: '/path/to/default', description: 'Default store' }]
 * }
 * ```
 */
export const listStoresFromRegistry = async (
    registryPath: string,
): Promise<Result<ListStoresResult, StoreToolError>> => {
    const registry = new FilesystemRegistry(registryPath);
    const loadResult = await registry.load();

    if (!loadResult.ok()) {
        // Handle REGISTRY_MISSING as empty list (like allowMissing: true did)
        if (loadResult.error.code === 'REGISTRY_MISSING') {
            return ok({ stores: [] });
        }
        return err({
            code: 'STORE_LIST_FAILED',
            message: `Failed to load store registry: ${loadResult.error.message}`,
            cause: loadResult.error,
        });
    }

    const stores: StoreInfo[] = Object.entries(loadResult.value)
        .map((
            [
                name, definition,
            ],
        ) => ({
            name,
            path: definition.path,
            ...(definition.description !== undefined && { description: definition.description }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return ok({ stores });
};

// ---------------------------------------------------------------------------
// Tool response types
// ---------------------------------------------------------------------------

/**
 * Standard response format for store MCP tools.
 */
export interface StoreToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
    isError?: boolean;
}

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
export const listStoresHandler = async (
    ctx: ToolContext,
): Promise<StoreToolResponse> => {
    const registry = ctx.cortex.getRegistry();
    const stores: StoreInfo[] = Object.entries(registry)
        .map(([
            name, definition,
        ]) => ({
            name,
            path: definition.path,
            ...(definition.description !== undefined && { description: definition.description }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
        content: [{ type: 'text', text: JSON.stringify({ stores }, null, 2) }],
    };
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
    ctx: ToolContext,
    input: CreateStoreInput,
): Promise<StoreToolResponse> => {
    // Validate input
    const validation = createStoreInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            content: [{ type: 'text', text: `Error: Store name is invalid: ${validation.error.issues[0]?.message}` }],
            isError: true,
        };
    }

    const registryPath = path.join(ctx.config.dataPath, 'stores.yaml');
    const registry = new FilesystemRegistry(registryPath);
    const storePath = path.join(ctx.config.dataPath, input.name);

    // Delegate to core's initializeStore which handles:
    // 1. Creating the store directory
    // 2. Registering the store in stores.yaml
    // 3. Creating the root category index
    const result = await initializeStore(registry, input.name, storePath);
    if (!result.ok()) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error.message}` }],
            isError: true,
        };
    }
    return {
        content: [{ type: 'text', text: JSON.stringify({ created: input.name }, null, 2) }],
    };
};
