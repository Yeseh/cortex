/**
 * StoreClient - Fluent API for store operations.
 *
 * Provides a client interface for accessing store metadata and navigating
 * to categories within the store. Supports lazy validation: navigation methods
 * return clients directly, but operations fail if the store doesn't exist.
 *
 * @module core/cortex/store-client
 */

import type { ScopedStorageAdapter, StoreNotFoundError } from '@/storage/adapter.ts';
import { CategoryClient } from './category-client.ts';

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
    private readonly adapter: ScopedStorageAdapter | null;

    /** Error to throw on first operation if store doesn't exist */
    private readonly storeError: StoreNotFoundError | null;

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
        adapter: ScopedStorageAdapter | null,
        description?: string,
        storeError?: StoreNotFoundError,
    ) {
        this.name = name;
        this.path = path;
        this.adapter = adapter;
        this.description = description;
        this.storeError = storeError ?? null;
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
    static create(
        name: string,
        path: string,
        adapter: ScopedStorageAdapter,
        description?: string,
    ): StoreClient {
        return new StoreClient(name, path, adapter, description);
    }

    /**
     * Creates a StoreClient for a store that doesn't exist.
     *
     * The returned client will throw on any operation that requires the adapter.
     *
     * @internal
     * @param name - Store name that wasn't found
     * @param availableStores - List of available store names for error message
     * @returns A StoreClient that throws on operations
     */
    static createNotFound(name: string, availableStores: string[]): StoreClient {
        const storeList = availableStores.length > 0 ? availableStores.join(', ') : '(none)';
        const error: StoreNotFoundError = {
            code: 'STORE_NOT_FOUND',
            message: `Store '${name}' is not registered. Available stores: ${storeList}`,
            store: name,
        };
        return new StoreClient(name, '', null, undefined, error);
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
    rootCategory(): CategoryClient {
        if (!this.adapter) {
            throw new Error(this.storeError?.message ?? `Store '${this.name}' is not available`);
        }
        return CategoryClient.create('/', this.adapter);
    }

    /**
     * Returns the underlying storage adapter.
     *
     * **Note:** This method is provided for internal use by CLI and server packages
     * that need direct access to storage operations during the transition
     * to the fluent client API. Prefer using `rootCategory()` for new code.
     *
     * @internal
     * @deprecated Use fluent API methods (rootCategory(), etc.) for new code.
     * @throws Error if the store doesn't exist
     * @returns The scoped storage adapter for this store
     *
     * @example
     * ```typescript
     * // Internal use - prefer rootCategory() for fluent API
     * const adapter = store.getAdapter();
     * const memory = await adapter.memories.read(memoryPath);
     * ```
     */
    getAdapter(): ScopedStorageAdapter {
        if (!this.adapter) {
            throw new Error(this.storeError?.message ?? `Store '${this.name}' is not available`);
        }
        return this.adapter;
    }

    /**
     * Returns whether this store exists in the registry.
     *
     * @returns true if the store exists, false otherwise
     */
    exists(): boolean {
        return this.adapter !== null;
    }

    /**
     * Returns the error if this store doesn't exist.
     *
     * @returns The StoreNotFoundError if store doesn't exist, null otherwise
     */
    getError(): StoreNotFoundError | null {
        return this.storeError;
    }
}
