/**
 * Initialize store operation.
 *
 * Provides the domain logic for creating new memory stores with proper directory
 * structure, registry registration, and index initialization. This is the primary
 * entry point for store creation in the Cortex system.
 *
 * @module core/store/operations/initialize
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CategoryPath } from '@/category/index.ts';
import type { Registry } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';
import { isValidStoreName } from '@/store/registry.ts';
import { storeError, type InitStoreError, type StoreResult } from '@/store/result.ts';
import { buildEmptyIndex } from './helpers.ts';

/**
 * Options for store initialization.
 *
 * Controls optional aspects of store creation including pre-seeded categories
 * and metadata for the registry entry.
 */
export interface InitStoreOptions {
    /**
     * Categories to create in the store.
     *
     * Each category will have:
     * - A directory created at `{storePath}/{category}`
     * - An empty index file written via IndexStorage
     * - An entry added to the root index's subcategories array
     *
     * Category names must be valid category path segments (lowercase letters,
     * numbers, hyphens). Nested paths like 'project/cortex' are supported.
     */
    categories?: string[];

    /**
     * Human-readable description for the store.
     *
     * Stored in the registry and surfaced by CLI list commands. Useful for
     * distinguishing between multiple stores (e.g., "Project-local memories"
     * vs "Global user preferences").
     */
    description?: string;
}

/**
 * Initializes a new store with proper directory structure and registry entry.
 *
 * This domain operation orchestrates the complete store creation workflow:
 *
 * 1. **Validates the store name** - Must be a lowercase slug (letters, numbers, hyphens)
 * 2. **Loads the registry** - Checks for name collisions with existing stores
 * 3. **Creates the store directory** - Uses recursive mkdir for the store path
 * 4. **Registers the store** - Adds entry to the persistent registry
 * 5. **Creates root index** - Writes index at CategoryPath.root() with subcategory references
 * 6. **Creates category subdirectories** - For each category in options, creates directory and index
 *
 * The operation is NOT atomic - partial failures may leave directories or registry
 * entries that need manual cleanup. Future versions may add rollback support.
 *
 * @param registry - The registry instance for store registration. Must be loaded
 *   or loadable (missing registry is handled gracefully).
 * @param name - The store name. Must be a valid lowercase slug matching pattern
 *   `^[a-z][a-z0-9-]*$`. Examples: 'cortex', 'my-project', 'user-data'.
 * @param path - Absolute filesystem path where the store will be created.
 *   The directory will be created if it doesn't exist.
 * @param options - Optional configuration for categories and description.
 * @returns Result with void on success, or InitStoreError on failure.
 *
 * @example Basic store creation
 * ```typescript
 * const registry = new FilesystemRegistry('/config/stores.yaml');
 * await registry.load();
 *
 * const result = await initializeStore(registry, 'my-project', '/data/my-project');
 *
 * if (result.ok()) {
 *   console.log('Store created with root index');
 * }
 * ```
 *
 * @example Store with pre-seeded categories
 * ```typescript
 * const result = await initializeStore(
 *   registry,
 *   'cortex',
 *   '/home/user/.cortex/memory',
 *   {
 *     categories: ['standards', 'decisions', 'map', 'todo'],
 *     description: 'Project-local knowledge base'
 *   }
 * );
 *
 * if (result.ok()) {
 *   // Root index includes subcategory entries for each category
 *   // Each category has its own empty index file
 * }
 * ```
 *
 * @example Error handling
 * ```typescript
 * const result = await initializeStore(registry, 'Invalid_Name', '/path');
 *
 * if (!result.ok()) {
 *   switch (result.error.code) {
 *     case 'INVALID_STORE_NAME':
 *       console.error('Name must be lowercase slug');
 *       break;
 *     case 'STORE_ALREADY_EXISTS':
 *       console.error('Store already registered');
 *       break;
 *     case 'STORE_CREATE_FAILED':
 *       console.error('Could not create directory');
 *       break;
 *     case 'STORE_INDEX_FAILED':
 *       console.error('Could not write index files');
 *       break;
 *   }
 * }
 * ```
 */
export const initializeStore = async (
    registry: Registry,
    name: string,
    path: string,
    options: InitStoreOptions = {},
): Promise<StoreResult<void, InitStoreError>> => {
    // 1. Validate store name
    if (!isValidStoreName(name)) {
        return storeError(
            'INVALID_STORE_NAME',
            `Store name '${name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
            { store: name },
        );
    }

    // 2. Load registry and check for collision
    const loadResult = await registry.load();
    // If registry is missing, that's okay - we'll create entries from scratch
    const currentRegistry = loadResult.ok() ? loadResult.value : {};

    // But if load failed for another reason, propagate the error
    if (!loadResult.ok() && loadResult.error?.code !== 'REGISTRY_MISSING') {
        return storeError(
            'REGISTRY_UPDATE_FAILED',
            `Failed to load registry: ${loadResult.error?.message ?? 'Unknown error'}`,
            { store: name, cause: loadResult.error },
        );
    }

    if (currentRegistry[name]) {
        return storeError('STORE_ALREADY_EXISTS', `Store '${name}' is already registered.`, {
            store: name,
        });
    }

    // 3. Create store directory
    try {
        await mkdir(path, { recursive: true });
    }
    catch (error) {
        return storeError('STORE_CREATE_FAILED', `Failed to create store directory at ${path}`, {
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
    if (!saveResult.ok()) {
        return storeError(
            'REGISTRY_UPDATE_FAILED',
            `Failed to save registry: ${saveResult.error?.message ?? 'Unknown error'}`,
            { store: name, cause: saveResult.error },
        );
    }

    // 5. Create root index via IndexStorage
    const categories = options.categories ?? [];
    const rootIndex = buildEmptyIndex(categories);
    const adapterResult = registry.getStore(name);
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
            const categoryPathObj = CategoryPath.fromString(category);
            if (!categoryPathObj.ok()) {
                return storeError(
                    'STORE_INDEX_FAILED',
                    `Invalid category path '${category}'.`,
                    { store: name, path: categoryPath, cause: categoryPathObj.error },
                );
            }
            const writeResult = await adapter.indexes.write(categoryPathObj.value, categoryIndex);
            if (!writeResult.ok()) {
                return storeError(
                    'STORE_INDEX_FAILED',
                    `Failed to write category index for '${category}'.`,
                    {
                        store: name,
                        path: categoryPath,
                        cause: writeResult.error,
                    },
                );
            }
        }
        catch (error) {
            return storeError('STORE_INDEX_FAILED', `Failed to create category '${category}'`, {
                store: name,
                path: categoryPath,
                cause: error,
            });
        }
    }

    return ok(undefined);
};
