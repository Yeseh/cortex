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
import type { StoreData } from './store.ts';
import type { StoreError, StoreResult } from './result.ts';
import { Slug } from '@/slug.ts';
import { initializeStore } from './operations/initialize.ts';
import { configCategoriesToStoreCategories } from '@/config/config.ts';

/**
 * Client for store operations.
 *
 * Provides fluent API for accessing store metadata and navigating
 * to the category tree. Uses lazy validation: the client is always returned
 * synchronously, but operations return `Result<T, E>` rather than throwing.
 *
 * @example
 * ```typescript
 * // Always returns a StoreClient (lazy validation)
 * const storeResult = cortex.getStore('my-project');
 * if (!storeResult.ok()) {
 *     console.error('Store not found:', storeResult.error.message);
 *     return;
 * }
 * const store = storeResult.value;
 *
 * // Load store metadata
 * const loadResult = await store.load();
 * if (!loadResult.ok()) {
 *     // STORE_NOT_INITIALIZED: store configured but not yet init'd
 *     // STORE_NOT_FOUND: storage read failed
 *     console.error(loadResult.error.message);
 *     return;
 * }
 *
 * console.log('Category mode:', loadResult.value.categoryMode);
 * ```
 */
export class StoreClient {
    /** Store name (e.g., 'my-project') */
    readonly name: string;

    /** Storage adapter for this store */
    readonly adapter: StorageAdapter;

    /** Store data, lazily loaded */
    data: StoreData | null = null;

    /**
     * Private constructor - use Cortex.getStore() to create instances.
     *
     * @param name - Store name
    * @param adapter - Storage adapter for operations
     */
    private constructor(name: string, adapter: StorageAdapter) {
        this.name = name;
        this.adapter = adapter;
        this.data = null;
    }

    /**
     * Creates a StoreClient for a valid store.
     *
     * @internal
     * @param name - Store name
     * @param adapter - Storage adapter for operations
     * @returns A StoreClient for the store
     */
    static init(name: string, adapter: StorageAdapter): StoreResult<StoreClient> {
        // TODO: This should not be necessary, remove Result<> wrapper and lazily load adapter in operations instead.
        if (!adapter) {
            return err({
                code: 'STORE_CREATE_FAILED',
                message: `Adapter was null or undefined for store '${name}'`,
                store: name,
            });
        }

        return ok(new StoreClient(name, adapter));
    }

    /**
     * Loads store metadata from storage.
     *
     * Returns `ok(StoreData)` on success. Returns an error if:
     * - `STORE_NAME_INVALID` — store name is not a valid slug
    * - `STORE_NOT_INITIALIZED` — store metadata is not initialized yet;
    *   run `cortex store init <name>` to initialize it
     * - `STORE_NOT_FOUND` — underlying storage read failed (permissions, disk error, etc.)
     *
     * @returns Result containing {@link StoreData} or a {@link StoreError}
     *
     * @example
     * ```typescript
     * const result = await storeClient.load();
     * if (!result.ok()) {
     *     if (result.error.code === 'STORE_NOT_INITIALIZED') {
     *         // Initialize with defaults
     *         await storeClient.initialize({ kind: 'filesystem', categoryMode: 'free', categories: [], properties: {} });
     *     }
     *     return;
     * }
     * console.log('Store loaded:', result.value.categoryMode);
     * ```
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

        const storeData = await this.adapter.config.getStore(parse.value.toString());
        if (!storeData.ok()) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Failed to load store '${this.name}': ${storeData.error.message}`,
                store: this.name.toString(),
                cause: storeData.error,
            });
        }

        // Handle null result: store is not registered in config yet
        if (storeData.value === null) {
            return err({
                code: 'STORE_NOT_INITIALIZED',
                message: `Store '${this.name}' has no configuration file. Run 'cortex store init ${this.name}' to initialize it.`,
                store: this.name.toString(),
            });
        }

        const categoriesResult = configCategoriesToStoreCategories(storeData.value.categories);
        if (!categoriesResult.ok()) {
            return err({
                code: 'STORE_READ_FAILED',
                message: `Failed to parse categories for store '${this.name}': ${categoriesResult.error.message}`,
                store: this.name.toString(),
                cause: categoriesResult.error,
            });
        }

        const normalizedStoreData: StoreData = {
            kind: storeData.value.kind,
            categoryMode: storeData.value.categoryMode ?? 'free',
            categories: categoriesResult.value,
            properties: storeData.value.properties,
            description: storeData.value.description,
        };

        this.data = normalizedStoreData;
        return ok(normalizedStoreData);
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

        const result = await this.adapter.config.saveStore(parse.value.toString(), data);
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

    /**
     * Initializes the store with the provided metadata by writing store config.
     *
     * Idempotent if the store already exists (overwrites existing data). Returns an error if:
     * - `STORE_NAME_INVALID` — store name is not a valid slug
     * - Any underlying storage write error
     *
     * @param data - Store configuration to persist
     * @returns Result indicating success or a {@link StoreError}
     *
     * @example
     * ```typescript
     * const result = await storeClient.initialize({
     *     kind: 'filesystem',
     *     categoryMode: 'free',
     *     categories: [],
     *     properties: {},
     * });
     * if (!result.ok()) {
     *     console.error('Failed to initialize store:', result.error.message);
     * }
     * ```
     */
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

        const result = await initializeStore(this.adapter, this.name, data);
        if (!result.ok()) {
            return result;
        }

        this.data = data;

        return ok(undefined);
    }

    /**
     * Returns the root category of this store.
     *
     * The root category is the entry point for navigating the category
     * tree. Use it to access subcategories and memories.
     *
     * @returns A CategoryClient for the root category (path "/")
     *
     * @example
     * ```typescript
     * const root = store.root();
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
        }

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
        const memoryClient = MemoryClient.pointTo(memoryPath, this.adapter);

        return memoryClient;
    }
}
