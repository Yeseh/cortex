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
import type { StoreData, StoreName } from './store.ts';
import type { StoreError, StoreResult } from './result.ts';
import { Slug } from '@/slug.ts';
import type { ConfigStore } from '@/config/types.ts';


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
    readonly name: StoreName;

    /** Storage adapter for this store (null if store not found) */
    private readonly adapter: StorageAdapter;

    /** Store data, lazily loaded */
    data: StoreData | null = null;

    /**
     * Private constructor - use Cortex.getStore() to create instances.
     *
     * @param name - Store name
     * @param adapter - Storage adapter for operations (null if not found)
     */
    private constructor(
        name: StoreName,
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
        if (!adapter) {
            return err({
               code: 'STORE_CREATE_FAILED',
               message: `Adapter was null or undefined for store '${name}'`,
               store: name,
            })
        }

        const storeName = Slug.from(name);
        if (!storeName.ok()) {
            return err({
                code: 'INVALID_STORE_NAME',
                message: `Store '${name}' has an invalid name.`,
                store: name,
            });
        }

        return ok(new StoreClient(storeName.value, adapter));
    }

    /**
     * Loads store metadata from storage. 
     * 
     * @returns {@link StoreData}
     */
    async load(): Promise<Result<StoreData, StoreError>> {
        if (this.data) {
            return ok(this.data);
        }

        const storeData = await this.adapter.stores.load(this.name);
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
        const result = await this.adapter.stores.save(this.name, data);
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
        const result = await this.adapter.stores.save(this.name, data);
        if (!result.ok()) {
            return err({
                code: 'STORE_SAVE_FAILED',
                message: `Failed to initialize store '${this.name}'.`,
                store: this.name.toString(),
                cause: result.error,
            });
        }

        const hierarchyResult = await this.ensureHierarchy();
        if (!hierarchyResult.ok()) {
            return err({
                code: 'STORE_INIT_FAILED',
                message: `Failed to ensure category hierarchy for store '${this.name}'.`,
                store: this.name.toString(),
                cause: hierarchyResult.error,
            });
        }

        this.data = data;

        return ok(undefined);
    }

    private async ensureHierarchy(): Promise<CategoryResult<void> | StoreResult<void>> {
        const configuredHierarhyResult = await this.load();
        if (!configuredHierarhyResult.ok()) {
            return err(configuredHierarhyResult.error);
        }

        for (const category of configuredHierarhyResult.value.categories) {
            const categoryResult = CategoryClient.init(category.path, this.adapter);
            if (!categoryResult.ok()) {
                return err(categoryResult.error);
            }

            const categoryClient = categoryResult.value;
            const ensureResult = await categoryClient.create();
            if (!ensureResult.ok()) {
                return err({
                    code: 'STORE_INIT_FAILED',
                    message: `Failed to create category '${category.path}' during store initialization.`,
                    store: this.name.toString(),
                    cause: ensureResult.error,
                });
            }
        }

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
        const memoryClient = MemoryClient.create(
            memoryPath, 
            memoryPath.split('/').slice(-1)[0]!, 
            this.adapter);   

        return memoryClient;
    }
}
