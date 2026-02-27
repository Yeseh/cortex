/**
 * Initialize store operation.
 *
 * @module core/store/operations/initialize
 */

import { ok } from '@/result.ts';
import { storeError, type StoreResult } from '@/store/result.ts';
import { Slug } from '@/slug.ts';
import type { StoreData } from '../store.ts';
import type { StorageAdapter } from '@/storage/index.ts';

/**
 * Initializes a store by persisting store metadata and ensuring configured categories.
 *
 * This domain operation:
 * 1. Validates the store name
 * 2. Checks whether store metadata already exists
 * 3. Persists store metadata through `ConfigAdapter`
 * 4. Ensures configured category paths through `CategoryAdapter`
 *
 * @param adapter - Storage adapter with config/category capabilities
 * @param name - The store name (must be a valid lowercase slug)
 * @param data - Store metadata to persist
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await initializeStore(adapter, 'my-project', {
 *   kind: 'filesystem',
 *   categoryMode: 'free',
 *   categories: [{ path: 'standards' }],
 *   properties: { path: '/path/to/store' },
 * });
 *
 * if (result.ok()) {
 *   console.log('Store created successfully');
 * }
 * ```
 */
export const initializeStore = async (
    { config, categories }: StorageAdapter,
    name: string,
    data: StoreData
): Promise<StoreResult<void>> => {
    // 1. Validate store name
    const slugResult = Slug.from(name);
    if (!slugResult.ok()) {
        return storeError(
            'STORE_NAME_INVALID',
            'Store name must be a lowercase slug (letters, numbers, hyphens).',
            { store: name }
        );
    }

    const storeName = slugResult.value;
    const storeResult = await config.getStore(storeName.toString());
    if (storeResult.ok() && storeResult.value !== null) {
        return storeError('STORE_ALREADY_EXISTS', 'Store name already exists in registry.', {
            store: name,
        });
    } else if (!storeResult.ok()) {
        return storeError(
            'STORE_READ_FAILED',
            `Failed to check whether store '${name}' already exists: ${storeResult.error.message}`,
            {
                store: name,
                cause: storeResult.error,
            }
        );
    }

    const saveResult = await config.saveStore(storeName.toString(), data);
    if (!saveResult.ok()) {
        return storeError(
            'STORE_CREATE_FAILED',
            `Failed to create store '${name}': ${saveResult.error.message}`,
            {
                store: name,
                cause: saveResult.error,
            }
        );
    }

    const initialCategories = data.categories ?? [];
    for (const category of initialCategories) {
        // TODO: Create what we can, warn instead?
        const categoryResult = await categories.ensure(category.path);
        if (!categoryResult.ok()) {
            return storeError(
                'STORE_CREATE_FAILED',
                `Failed to initialie store category '${name}' in store '${storeName}'.`,
                { store: name, cause: categoryResult.error }
            );
        }
    }

    return ok(undefined);
};
