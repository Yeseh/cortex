/**
 * Initialize store operation.
 *
 * @module core/store/operations/initialize
 */

import { ok } from '@/result.ts';
import { storeError, type StoreResult } from '@/store/result.ts';
import { Slug } from '@/slug.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { defaultProjectCategories } from '@/category/category-templates.ts';
import { configCategoriesToStoreCategories } from '@/config/config.ts';
import type { StoreCategories, StoreData } from '../store.ts';
import type { StorageAdapter } from '@/storage/index.ts';
import type { CategoryAdapter } from '@/storage/category-adapter.ts';

/**
 * Initializes a store by persisting store metadata and ensuring configured categories.
 *
 * This domain operation:
 * 1. Validates the store name
 * 2. Checks whether store metadata already exists
 * 3. Persists store metadata through `ConfigAdapter`
 * 4. Creates the store root directory through `CategoryAdapter`
 * 5. Ensures configured category paths through `CategoryAdapter`
 *
 * When `data.categories` is empty or not provided, `defaultProjectCategories` is
 * used as the seed set so new stores are pre-populated with a standard layout.
 *
 * @param adapter - Storage adapter with config/category capabilities
 * @param name - The store name (must be a valid lowercase slug)
 * @param data - Store metadata to persist
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * // With explicit categories
 * const result = await initializeStore(adapter, 'my-project', {
 *   kind: 'filesystem',
 *   categoryMode: 'free',
 *   categories: [{ path: 'standards' }],
 *   properties: { path: '/path/to/store' },
 * });
 *
 * // Without categories — defaults to defaultProjectCategories
 * const result = await initializeStore(adapter, 'my-project', {
 *   kind: 'filesystem',
 *   categoryMode: 'free',
 *   categories: [],
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

    // When no categories are provided, seed with default project categories.
    // Resolved before saveStore so the config.yaml reflects the actual categories.
    // Unwrapped directly — defaultProjectCategories is a predefined constant with
    // valid paths, so a failure here is a programming error, not a runtime condition.
    const initialCategories =
        (data.categories ?? []).length > 0
            ? data.categories!
            : configCategoriesToStoreCategories(defaultProjectCategories).unwrap();

    const saveResult = await config.saveStore(storeName.toString(), {
        ...data,
        categories: initialCategories,
    });
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

    // Create the store root directory
    const rootResult = await categories.ensure(CategoryPath.root());
    if (!rootResult.ok()) {
        return storeError(
            'STORE_CREATE_FAILED',
            `Failed to create store root directory for '${name}': ${rootResult.error.message}`,
            { store: name, cause: rootResult.error }
        );
    }

    const ensureCategories = async (
        adapter: CategoryAdapter,
        items: StoreCategories
    ): Promise<StoreResult<void>> => {
        for (const category of items) {
            const ensureResult = await adapter.ensure(category.path);
            if (!ensureResult.ok()) {
                return storeError(
                    'STORE_CREATE_FAILED',
                    `Failed to initialize store category '${category.path.toString()}' in store '${storeName}'.`,
                    { store: name, cause: ensureResult.error }
                );
            }

            if (category.description) {
                const descResult = await adapter.setDescription(
                    category.path,
                    category.description
                );
                if (!descResult.ok()) {
                    return storeError(
                        'STORE_CREATE_FAILED',
                        `Failed to set description for category '${category.path.toString()}' in store '${storeName}'.`,
                        { store: name, cause: descResult.error }
                    );
                }
            }

            if (category.subcategories && category.subcategories.length > 0) {
                const subResult = await ensureCategories(adapter, category.subcategories);
                if (!subResult.ok()) return subResult;
            }
        }
        return ok(undefined);
    };

    const categoriesResult = await ensureCategories(categories, initialCategories);
    if (!categoriesResult.ok()) return categoriesResult;

    return ok(undefined);
};
