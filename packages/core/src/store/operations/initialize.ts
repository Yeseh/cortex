/**
 * Initialize store operation.
 *
 * @module core/store/operations/initialize
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CategoryPath } from '@/category/category-path.ts';
import type { Cortex } from '@/cortex/cortex.ts';
import { ok } from '@/result.ts';
import { isValidStoreName } from '@/store/registry.ts';
import { storeError, type InitStoreError, type StoreResult } from '@/store/result.ts';
import { buildEmptyIndex } from './helpers.ts';

/** Options for store initialization. */
export interface InitStoreOptions {
    /** Categories to create in the store (creates directories and indexes) */
    categories?: string[];
    /** Optional description for the store in the registry */
    description?: string;
}

/**
 * Initializes a new store with proper directory structure and registry entry.
 *
 * This domain operation:
 * 1. Validates the store name
 * 2. Checks for name collision in the registry
 * 3. Creates the store directory
 * 4. Registers the store in Cortex (persists to config.yaml)
 * 5. Creates a root index entry via IndexStorage
 * 6. Optionally creates category subdirectories with indexes
 *
 * @param cortex - The Cortex client for store registration
 * @param name - The store name (must be a valid lowercase slug)
 * @param path - The filesystem path for the store
 * @param options - Optional settings for categories and description
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const cortex = await Cortex.fromConfig('~/.config/cortex');
 *
 * const result = await initializeStore(
 *   cortex.value,
 *   'my-project',
 *   '/path/to/store',
 *   { categories: ['global', 'projects'] }
 * );
 *
 * if (result.ok()) {
 *   console.log('Store created successfully');
 * }
 * ```
 */
export const initializeStore = async (
    cortex: Cortex,
    name: string,
    path: string,
    options: InitStoreOptions = {}
): Promise<StoreResult<void, InitStoreError>> => {
    // 1. Validate store name
    if (!isValidStoreName(name)) {
        return storeError(
            'INVALID_STORE_NAME',
            `Store name '${name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
            { store: name }
        );
    }

    // 2. Check for collision in registry
    if (cortex.hasStore(name)) {
        return storeError('STORE_ALREADY_EXISTS', `Store '${name}' is already registered.`, {
            store: name,
        });
    }

    // 3. Create store directory
    try {
        await mkdir(path, { recursive: true });
    } catch (error) {
        return storeError('STORE_CREATE_FAILED', `Failed to create store directory at ${path}`, {
            store: name,
            path,
            cause: error,
        });
    }

    // 4. Register in Cortex (persists to config.yaml)
    const storeDefinition = {
        path,
        ...(options.description !== undefined && { description: options.description }),
    };
    const addResult = await cortex.addStore(name, storeDefinition);
    if (!addResult.ok()) {
        return storeError(
            'REGISTRY_UPDATE_FAILED',
            `Failed to register store: ${addResult.error.message}`,
            { store: name, cause: addResult.error }
        );
    }

    // 5. Create root index via IndexStorage
    const categories = options.categories ?? [];
    const rootIndex = buildEmptyIndex(categories);
    const adapterResult = cortex.getStore(name);
    if (!adapterResult.ok()) {
        return storeError('STORE_INDEX_FAILED', `Failed to resolve store adapter for '${name}'.`, {
            store: name,
            path,
            cause: adapterResult.error,
        });
    }
    const adapter = adapterResult.value;
    const rootIndexResult = await adapter.indexes.write(CategoryPath.root(), rootIndex);
    if (!rootIndexResult.ok()) {
        return storeError('STORE_INDEX_FAILED', `Failed to write root index at ${path}.`, {
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
            const catPathResult = CategoryPath.fromString(category);
            if (!catPathResult.ok()) {
                return storeError(
                    'STORE_INDEX_FAILED',
                    `Invalid category path '${category}': ${catPathResult.error.message}`,
                    {
                        store: name,
                        path: categoryPath,
                        cause: catPathResult.error,
                    }
                );
            }
            const writeResult = await adapter.indexes.write(catPathResult.value, categoryIndex);
            if (!writeResult.ok()) {
                return storeError(
                    'STORE_INDEX_FAILED',
                    `Failed to write category index for '${category}'.`,
                    {
                        store: name,
                        path: categoryPath,
                        cause: writeResult.error,
                    }
                );
            }
        } catch (error) {
            return storeError('STORE_INDEX_FAILED', `Failed to create category '${category}'`, {
                store: name,
                path: categoryPath,
                cause: error,
            });
        }
    }

    return ok(undefined);
};
