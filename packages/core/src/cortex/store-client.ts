/**
 * StoreClient - Fluent API for store operations.
 *
 * Provides a client interface for accessing store metadata and navigating
 * to categories within the store. Supports lazy validation: navigation methods
 * return clients directly, but operations fail if the store doesn't exist.
 *
 * @module core/cortex/store-client
 */

import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { CategoryClient } from './category-client.ts';
import { err, ok, type ErrorDetails, type Result } from '@/result.ts';
import { MemoryClient } from './memory-client.ts';
import type { MemoryResult } from '@/memory/result.ts';
import type { CategoryResult } from '@/category/types.ts';

export type StoreErrorCode = 'STORE_NOT_FOUND' | 'INVALID_STORE_ADAPTER';
export type StoreClientError = ErrorDetails<StoreErrorCode>;
export type StoreClientResult<T> = Result<T, StoreClientError>;

/**
 * Client for store operations.
 *
 * Provides fluent API for accessing store metadata and navigating
 * to the category tree. Uses lazy validation: the client is always returned
 * synchronously, but operations will throw if the store doesn't exist.
 *
 * @example
 * ```typescript
 * // Always returns a StoreClient (lazy validation)
 * const store = cortex.getStore('my-project');
 * console.log(store.name);        // 'my-project'
 *
 * // Operations throw if store doesn't exist
 * try {
 *     const root = store.rootCategory();
 *     const standards = root.getCategory('standards');
 * } catch (e) {
 *     console.error('Store not found:', e.message);
 * }
 * ```
 */
export class StoreClient {
    /** Store name (e.g., 'my-project') */
    readonly name: string;

    /** Filesystem path to store root directory (empty if store not found) */
    readonly path: string;

    /** Optional human-readable description */
    readonly description?: string;

    /** Storage adapter for this store (null if store not found) */
    private readonly adapter: ScopedStorageAdapter;

    /**
     * Private constructor - use Cortex.getStore() to create instances.
     *
     * @param name - Store name
     * @param path - Filesystem path to store (empty if not found)
     * @param adapter - Storage adapter for operations (null if not found)
     * @param description - Optional store description
     * @param storeError - Error to throw if store doesn't exist
     */
    private constructor(
        name: string,
        path: string,
        adapter: ScopedStorageAdapter,
        description?: string,
    ) {
        this.name = name;
        this.path = path;
        this.adapter = adapter;
        this.description = description;
    }

    /**
     * Creates a StoreClient for a valid store.
     *
     * @internal
     * @param name - Store name
     * @param path - Filesystem path to store
     * @param adapter - Storage adapter for operations
     * @param description - Optional store description
     * @returns A StoreClient for the store
     */
    static init(
        name: string,
        path: string,
        adapter: ScopedStorageAdapter,
        description?: string,
    ): StoreClientResult<StoreClient> {
        if (!adapter) {
            return err({
               code: 'INVALID_STORE_ADAPTER',
               message: `Adapter was null or undefined for store '${name}' at path '${path}'`,
               store: name,
               path, 
            })
        }

        return ok(new StoreClient(name, path, adapter, description));
    }

    /**
     * Returns the root category of this store.
     *
     * The root category is the entry point for navigating the category
     * tree. Use it to access subcategories and memories.
     *
     * @throws Error if the store doesn't exist
     * @returns A CategoryClient for the root category (path "/")
     *
     * @example
     * ```typescript
     * const root = store.rootCategory();
     * console.log(root.rawPath); // '/'
     *
     * const standards = root.getCategory('standards');
     * const memories = await standards.listMemories();
     * ```
     */
    root(): StoreClientResult<CategoryClient> {
        const category = CategoryClient.init('/', this.adapter);
        if (!category.ok()) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${this.name}' not found at path '${this.path}'`,
                store: this.name,
            });
        };

        return ok(category.value);
    }

    getCategory(categoryPath: string): CategoryResult<CategoryClient> {
        const category = CategoryClient.init(categoryPath, this.adapter);
        if (!category.ok()) {
            return category;
        }

        return ok(category.value);
    }

    getMemory(memoryPath: string): MemoryClient {
        const memoryClient = MemoryClient.create(
            memoryPath, 
            memoryPath.split('/').slice(-1)[0]!, 
            this.adapter);   

        return memoryClient;
    }
}
