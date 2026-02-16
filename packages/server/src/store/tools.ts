/**
 * Store listing utilities and validation schemas for MCP tools.
 *
 * This module provides:
 * - Functions for listing stores from Cortex registry
 * - Validation schemas for store names and tool inputs
 * - Types for store information and listing results
 *
 * Store creation is handled by {@link @yeseh/cortex-core/store#initializeStore}
 * in the tool registration layer, keeping this module focused on read operations.
 *
 * @module server/store/tools
 */

import { z } from 'zod';
import type { Cortex, StoreDefinition } from '@yeseh/cortex-core';
import { ok, type Result } from '@yeseh/cortex-core';

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
 * Lists all available memory stores from the Cortex registry.
 *
 * Returns all registered stores with their names, paths, and optional
 * descriptions from the Cortex instance.
 *
 * @param cortex - Cortex client instance containing the registry
 * @returns Result with list of stores
 *
 * @example
 * ```ts
 * const result = listStoresFromCortex(cortex);
 * if (result.ok()) {
 *   console.log('Stores:', result.value.stores);
 *   // [{ name: 'default', path: '/path/to/default', description: 'Default store' }]
 * }
 * ```
 */
export const listStoresFromCortex = (cortex: Cortex): Result<ListStoresResult, StoreToolError> => {
    const storeDefinitions = cortex.getStoreDefinitions();
    const stores: StoreInfo[] = Object.entries(storeDefinitions)
        .map(([
            name, definition]: [string, StoreDefinition,
        ]) => ({
            name,
            path: definition.path,
            ...(definition.description !== undefined && { description: definition.description }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return ok({ stores });
};
