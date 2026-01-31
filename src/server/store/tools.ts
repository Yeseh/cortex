/**
 * Store management tool implementations for the MCP server.
 *
 * This module provides functions for listing and creating memory stores.
 * Stores are directories within the configured data path that contain
 * memory entries organized by category.
 *
 * @module server/store/tools
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { Result } from '../../core/types.ts';
import { FilesystemRegistry } from '../../core/storage/filesystem/index.ts';

/**
 * Error codes for store tool operations.
 *
 * - `STORE_LIST_FAILED` - Could not read the data directory
 * - `STORE_CREATE_FAILED` - Could not create the store directory
 * - `STORE_ALREADY_EXISTS` - Store with the given name already exists
 * - `INVALID_STORE_NAME` - Store name contains invalid characters
 */
export type StoreToolErrorCode =
    | 'STORE_LIST_FAILED'
    | 'STORE_CREATE_FAILED'
    | 'STORE_ALREADY_EXISTS'
    | 'INVALID_STORE_NAME';

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
 * if (result.ok) {
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
        return { ok: true, value: stores };
    }
    catch (error) {
    // Handle ENOENT (data path doesn't exist yet) by returning empty array
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return { ok: true, value: [] }; 
        }
        return {
            ok: false,
            error: {
                code: 'STORE_LIST_FAILED',
                message: `Failed to list stores: ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
            },
        };
    } 
};

/**
 * Creates a new memory store directory.
 *
 * Validates the store name format, checks if the store already exists,
 * and creates the directory at `${dataPath}/${name}`.
 *
 * @param dataPath - Directory where stores are persisted
 * @param name - Name of the store to create
 * @returns Result indicating success or error
 *
 * @example
 * ```ts
 * const result = await createStore('./.cortex-data', 'my-project');
 * if (result.ok) {
 *   console.log('Store created successfully');
 * } else if (result.error.code === 'STORE_ALREADY_EXISTS') {
 *   console.log('Store already exists');
 * }
 * ```
 */
export const createStore = async (
    dataPath: string,
    name: string,
): Promise<Result<void, StoreToolError>> => {
    // Validate store name format
    const nameValidation = storeNameSchema.safeParse(name);
    if (!nameValidation.success) {
        return {
            ok: false,
            error: {
                code: 'INVALID_STORE_NAME',
                message: nameValidation.error.issues.map((i) => i.message).join('; '),
            },
        }; 
    }

    const storePath = path.join(
        dataPath, name,
    );

    // Check if store already exists
    try {
        const stat = await fs.stat(storePath);
        if (stat.isDirectory()) {
            return {
                ok: false,
                error: {
                    code: 'STORE_ALREADY_EXISTS',
                    message: `Store '${name}' already exists`,
                },
            }; 
        }
    }
    catch (error) {
        // ENOENT is expected - store doesn't exist yet
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            return {
                ok: false,
                error: {
                    code: 'STORE_CREATE_FAILED',
                    message: `Failed to check store existence: ${error instanceof Error ? error.message : String(error)}`,
                    cause: error,
                },
            }; 
        } 
    }

    // Create the store directory
    try {
        await fs.mkdir(
            storePath, { recursive: true },
        );
        return { ok: true, value: undefined };
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: 'STORE_CREATE_FAILED',
                message: `Failed to create store '${name}': ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
            },
        }; 
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
 * if (result.ok) {
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

    if (!loadResult.ok) {
        // Handle REGISTRY_MISSING as empty list (like allowMissing: true did)
        if (loadResult.error.code === 'REGISTRY_MISSING') {
            return { ok: true, value: { stores: [] } };
        }
        return {
            ok: false,
            error: {
                code: 'STORE_LIST_FAILED',
                message: `Failed to load store registry: ${loadResult.error.message}`,
                cause: loadResult.error,
            },
        };
    }

    const stores: StoreInfo[] = Object.entries(loadResult.value)
        .map((
            [name, definition],
        ) => ({
            name,
            path: definition.path,
            ...(definition.description !== undefined && { description: definition.description }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return { ok: true, value: { stores } };
};
