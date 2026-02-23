/**
 * Initialize store operation.
 *
 * @module core/store/operations/initialize
 */

import { err, ok } from '@/result.ts';
import { storeError, type StoreResult } from '@/store/result.ts';
import { Slug } from '@/slug.ts';
import type { Store, StoreData } from '../store.ts';
import type { StorageAdapter } from '@/storage/index.ts';
import { CategoryPath } from '@/category/category-path.ts';

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
 * @param adapter - The registry to use for store registration
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
 * if (result.ok()) {
 *   console.log('Store created successfully');
 * }
 * ```
 */
export const initializeStore = async (
    { stores, categories }: StorageAdapter,
    name: string,
    data: StoreData,
): Promise<StoreResult<void>> => {
    // 1. Validate store name
    const slugResult = Slug.from(name);
    if (!slugResult.ok()) {
        return storeError(
            'STORE_NAME_INVALID',
            'Store name must be a lowercase slug (letters, numbers, hyphens).',
            { store: name },
        );
    }

    const storeName = slugResult.value;
    const storeResult = await stores.load(storeName);
    if (storeResult.ok() && storeResult.value !== null) {
        return storeError('STORE_ALREADY_EXISTS', 'Store name already exists in registry.', {
            store: name,
            cause: storeResult.error,
        });
    }
    else if (!storeResult.ok() && storeResult.error.code !== 'STORE_NOT_FOUND') {
        return err(storeResult.error);
    }

    const saveResult = await stores.save(storeName, data);
    if (!saveResult.ok()) {
        return err(saveResult.error);
    }

    const initialCategories = data.categories ?? [];
    for (const category of initialCategories) {
        // TODO: Create what we can, warn instead?
        const categoryResult = await categories.ensure(category.path);
        if (!categoryResult.ok()) {
            return storeError(
                'STORE_CREATE_FAILED',
                `Failed to initialie store category '${name}' in store '${storeName}'.`,
                { store: name, cause: categoryResult.error },
            );
        }
    }

    return ok(undefined);
};
