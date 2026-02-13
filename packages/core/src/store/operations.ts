/**
 * Domain operations for store management.
 *
 * This module provides high-level operations for managing stores,
 * separate from the storage backend implementation.
 *
 * @module core/store/operations
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Result } from '../types.ts';
import type { Registry } from '../storage/adapter.ts';
import type { CategoryIndex } from '../index/types.ts';
import { isValidStoreName } from './registry.ts';

/**
 * Error codes for store initialization operations.
 *
 * - `STORE_ALREADY_EXISTS` - A store with the given name is already registered
 * - `STORE_CREATE_FAILED` - Failed to create the store directory on disk
 * - `STORE_INDEX_FAILED` - Failed to create or write an index file
 * - `REGISTRY_UPDATE_FAILED` - Failed to update the store registry file
 * - `INVALID_STORE_NAME` - Store name doesn't match required format (lowercase slug)
 */
export type InitStoreErrorCode =
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_CREATE_FAILED'
    | 'STORE_INDEX_FAILED'
    | 'REGISTRY_UPDATE_FAILED'
    | 'INVALID_STORE_NAME';

/**
 * Error details for store initialization operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing store, path, or underlying cause.
 */
export interface InitStoreError {
    /** Machine-readable error code for programmatic handling */
    code: InitStoreErrorCode;
    /** Human-readable error message describing what went wrong */
    message: string;
    /** Store name involved in the error (when applicable) */
    store?: string;
    /** Filesystem path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}

/**
 * Options for store initialization.
 */
export interface InitStoreOptions {
    /** Categories to create in the store (creates directories and indexes) */
    categories?: string[];
    /** Optional description for the store in the registry */
    description?: string;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Creates an empty category index with optional subcategories.
 */
const buildEmptyIndex = (subcategories: string[] = []): CategoryIndex => ({
    memories: [],
    subcategories: subcategories.map((name) => ({
        path: name,
        memoryCount: 0,
    })),
});

/**
 * Initializes a new store with proper directory structure and registry entry.
 *
 * This domain operation:
 * 1. Validates the store name
 * 2. Loads the registry and checks for name collision
 * 3. Creates the store directory
 * 4. Registers the store in the registry
 * 5. Creates a root index entry via IndexStorage
 * 6. Optionally creates category subdirectories with indexes
 *
 * @param registry - The registry to use for store registration
 * @param name - The store name (must be a valid lowercase slug)
 * @param path - The filesystem path for the store
 * @param options - Optional settings for categories and description
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const registry = new FilesystemRegistry('/config/stores.yaml');
 * await registry.load();
 *
 * const result = await initializeStore(
 *   registry,
 *   'my-project',
 *   '/path/to/store',
 *   { categories: ['global', 'projects'] }
 * );
 *
 * if (result.ok) {
 *   console.log('Store created successfully');
 * }
 * ```
 */
export const initializeStore = async (
    registry: Registry,
    name: string,
    path: string,
    options: InitStoreOptions = {},
): Promise<Result<void, InitStoreError>> => {
    // 1. Validate store name
    if (!isValidStoreName(name)) {
        return err({
            code: 'INVALID_STORE_NAME',
            message: `Store name '${name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
            store: name,
        });
    }

    // 2. Load registry and check for collision
    const loadResult = await registry.load();
    // If registry is missing, that's okay - we'll create entries from scratch
    const currentRegistry = loadResult.ok ? loadResult.value : {};

    // But if load failed for another reason, propagate the error
    if (!loadResult.ok && loadResult.error.code !== 'REGISTRY_MISSING') {
        return err({
            code: 'REGISTRY_UPDATE_FAILED',
            message: `Failed to load registry: ${loadResult.error.message}`,
            store: name,
            cause: loadResult.error,
        });
    }

    if (currentRegistry[name]) {
        return err({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${name}' is already registered.`,
            store: name,
        });
    }

    // 3. Create store directory
    try {
        await mkdir(path, { recursive: true });
    }
    catch (error) {
        return err({
            code: 'STORE_CREATE_FAILED',
            message: `Failed to create store directory at ${path}`,
            store: name,
            path,
            cause: error,
        });
    }

    // 4. Register in registry
    const updatedRegistry = {
        ...currentRegistry,
        [name]: {
            path,
            ...(options.description !== undefined && { description: options.description }),
        },
    };

    const saveResult = await registry.save(updatedRegistry);
    if (!saveResult.ok) {
        return err({
            code: 'REGISTRY_UPDATE_FAILED',
            message: `Failed to save registry: ${saveResult.error.message}`,
            store: name,
            cause: saveResult.error,
        });
    }

    // 5. Create root index via IndexStorage
    const categories = options.categories ?? [];
    const rootIndex = buildEmptyIndex(categories);
    const adapterResult = registry.getStore(name);
    if (!adapterResult.ok) {
        return err({
            code: 'STORE_INDEX_FAILED',
            message: `Failed to resolve store adapter for '${name}'.`,
            store: name,
            path,
            cause: adapterResult.error,
        });
    }
    const rootIndexResult = await adapterResult.value.indexes.write('', rootIndex);
    if (!rootIndexResult.ok) {
        return err({
            code: 'STORE_INDEX_FAILED',
            message: `Failed to write root index at ${path}.`,
            store: name,
            path,
            cause: rootIndexResult.error,
        });
    }

    // 6. Create category subdirectories and indexes
    for (const category of categories) {
        const categoryPath = join(path, category);
        try {
            await mkdir(categoryPath, { recursive: true });
            const categoryIndex = buildEmptyIndex();
            const writeResult = await adapterResult.value.indexes.write(category, categoryIndex);
            if (!writeResult.ok) {
                return err({
                    code: 'STORE_INDEX_FAILED',
                    message: `Failed to write category index for '${category}'.`,
                    store: name,
                    path: categoryPath,
                    cause: writeResult.error,
                });
            }
        }
        catch (error) {
            return err({
                code: 'STORE_INDEX_FAILED',
                message: `Failed to create category '${category}'`,
                store: name,
                path: categoryPath,
                cause: error,
            });
        }
    }

    return ok(undefined);
};
