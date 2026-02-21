/**
 * StoreClient - Fluent API for store operations.
 *
 * Provides a client interface for accessing store metadata and navigating
 * to categories within the store. Supports lazy validation: navigation methods
 * return clients directly, but operations fail if the store doesn't exist.
 *
 * @module core/cortex/store-client
 */

import type { StorageAdapter } from '@/storage/index.ts';
import { CategoryClient } from '../category/category-client.ts';
import { err, ok, type Result } from '@/result.ts';
import { MemoryClient } from '../memory/memory-client.ts';
import type { CategoryResult } from '@/category/types.ts';
import type { Store, StoreData, StoreName } from './store.ts';
import type { StoreError, StoreResult } from './result.ts';
import { Slug } from '@/slug.ts';
import type { ConfigStore } from '@/config/types.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';
import { initializeStore } from './operations/initialize.ts';


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

    /** Storage adapter for this store (null if store not found) */
    readonly adapter: StorageAdapter;

    /** Store data, lazily loaded */
    data: StoreData | null = null;

    /**
     * Private constructor - use Cortex.getStore() to create instances.
     *
     * @param name - Store name
     * @param adapter - Storage adapter for operations (null if not found)
     */
    private constructor(
        name: string,
        adapter: StorageAdapter,
    ) {
        this.name = name;
        this.adapter = adapter;
        this.data = null;
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
        adapter: StorageAdapter,
    ): StoreResult<StoreClient> {
        // TODO: This should not be necessary, remove Result<> wrapper and lazily load adapter in operations instead. 
        if (!adapter) {
            return err({
               code: 'STORE_CREATE_FAILED',
               message: `Adapter was null or undefined for store '${name}'`,
               store: name,
            })
        }

        return ok(new StoreClient(name, adapter));
    }

    /**
     * Loads store metadata from storage. 
     * 
     * @returns {@link StoreData}
     */
    async load(): Promise<Result<StoreData, StoreError>> {
        const parse = Slug.from(this.name);
        if (!parse.ok()) {
            return err({
                code: 'STORE_NAME_INVALID',
                message: `Store name '${this.name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
                store: this.name.toString(),
                cause: parse.error,
            });
        }

        const storeData = await this.adapter.stores.load(parse.value);
        if (!storeData.ok()) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${this.name}' not found in registry.`,
                store: this.name.toString(),
                cause: storeData.error,
            });
        }

        this.data = storeData.value;
        return ok(storeData.value as StoreData);
    }

    /**
     * Saves store metadata to storage.
     * 
     * @param data - Store data to save
     * @returns Result indicating success or failure
     */
    async save(data: StoreData): Promise<StoreResult<void>> {
        const parse = Slug.from(this.name);
        if (!parse.ok()) {
            return err({
                code: 'STORE_NAME_INVALID',
                message: `Store name '${this.name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
                store: this.name.toString(),
                cause: parse.error,
            });
        }

        const result = await this.adapter.stores.save(parse.value, data);
        if (!result.ok()) {
            return err({
                code: 'STORE_SAVE_FAILED',
                message: `Failed to save store '${this.name}'.`,
                store: this.name.toString(),
                cause: result.error,
            });
        }

        this.data = data;

        return ok(undefined);
    }

    async initialize(data: StoreData): Promise<StoreResult<void>> {
        const parse = Slug.from(this.name);
        if (!parse.ok()) {
            return err({
                code: 'STORE_NAME_INVALID',
                message: `Store name '${this.name}' is invalid. Must be a lowercase slug (letters, numbers, hyphens).`,
                store: this.name.toString(),
                cause: parse.error,
            });
        }

        await initializeStore(this.adapter, this.name, data);

        this.data = data;

        return ok(undefined);
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
    root(): CategoryResult<CategoryClient> {
        const categoryResult = CategoryClient.init('/', this.adapter);
        if (!categoryResult.ok()) {
            return categoryResult;
        };

        return ok(categoryResult.value);
    }

    getCategory(categoryPath: string): CategoryResult<CategoryClient> {
        const categoryResult = CategoryClient.init(categoryPath, this.adapter);
        if (!categoryResult.ok()) {
            return categoryResult;
        }

        return ok(categoryResult.value);
    }

    getMemory(memoryPath: string): MemoryClient {
        const memoryClient = MemoryClient.pointTo(
            memoryPath, 
            this.adapter);   

        return memoryClient;
    }
}
