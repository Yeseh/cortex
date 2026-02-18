/**
 * StoreClient - Fluent API for store operations.
 *
 * Provides a client interface for accessing store metadata and navigating
 * to categories within the store.
 *
 * @module core/cortex/store-client
 */

import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { CategoryClient } from './category-client.ts';

/**
 * Client for store operations.
 *
 * Provides fluent API for accessing store metadata and navigating
 * to the category tree.
 *
 * @example
 * ```typescript
 * const store = cortex.getStore('my-project');
 * if (store.ok) {
 *     console.log(store.value.name);        // 'my-project'
 *     console.log(store.value.path);        // '/data/my-project'
 *     console.log(store.value.description); // 'Project memories'
 *
 *     const root = store.value.rootCategory();
 *     const standards = root.getCategory('standards');
 * }
 * ```
 */
export class StoreClient {
    /** Store name (e.g., 'my-project') */
    readonly name: string;

    /** Filesystem path to store root directory */
    readonly path: string;

    /** Optional human-readable description */
    readonly description?: string;

    /** Storage adapter for this store (internal use only) */
    private readonly adapter: ScopedStorageAdapter;

    /**
     * Private constructor - use Cortex.getStore() to create instances.
     *
     * @param name - Store name
     * @param path - Filesystem path to store
     * @param adapter - Storage adapter for operations
     * @param description - Optional store description
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
     * Creates a StoreClient for a store.
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
     * Returns the root category of this store.
     *
     * The root category is the entry point for navigating the category
     * tree. Use it to access subcategories and memories.
     *
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
        return this.adapter;
    }
}
