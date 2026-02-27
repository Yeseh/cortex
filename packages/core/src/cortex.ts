/**
 * Cortex - Root client for the memory system.
 *
 * Provides the main entry point for creating and managing Cortex instances.
 * Creation is programmatic via `init()` with an injected adapter factory.
 *
 * @module core/cortex/cortex
 *
 * @example
 * ```typescript
 * // Create programmatically (for testing or embedded use)
 * const cortex = Cortex.init({
 *     adapterFactory: (storeName) => createAdapterForStore(storeName),
 * });
 *
 * // Get a store client
 * const storeResult = cortex.getStore('my-store');
 * if (storeResult.ok()) {
 *     const root = storeResult.value.root();
 *     const result = await root.getCategory('standards').exists();
 * }
 * ```
 */

import type { StorageAdapter } from '@/storage/index.ts';
import { type CortexOptions, type AdapterFactory } from './types.ts';
import { StoreClient } from './store/store-client.ts';
import { err, ok, type ErrorDetails, type Result } from '@/result.ts';

export type CortexErrorCode = 'STORE_NOT_FOUND' | 'INVALID_STORE_ADAPTER';
export type CortexClientError = ErrorDetails<CortexErrorCode>;
export type CortexClientResult<T> = Result<T, CortexClientError>;

// =============================================================================
// Cortex Class
// =============================================================================

/**
 * Root client for the Cortex memory system.
 *
 * The Cortex class manages adapter creation and provides access to
 * store-scoped clients.
 *
 * **Creation patterns:**
 * - `Cortex.init(options)` - Synchronous, programmatic creation
 *
 * **Lifecycle:**
 * 1. Create via `init()`
 * 2. Use `getStore(name)` to resolve a store client
 */
export class Cortex {
    /** Factory for creating scoped storage adapters */
    private readonly adapterFactory: AdapterFactory;

    /**
     * Private constructor - use `Cortex.init()`.
     */
    private constructor(options: CortexOptions) {
        this.adapterFactory = options.adapterFactory;
    }

    /**
     * Creates a Cortex instance programmatically.
     *
     * This is a synchronous factory that does not perform any filesystem
     * operations. Use this for testing with mock adapters or when you
     * want full control over configuration.
     *
     * @param options - Configuration options
     * @returns A new Cortex instance
     *
     * @example
     * ```typescript
    * // With custom settings and stores
     * const cortex = Cortex.init({
    *     adapterFactory: (storeName) => createAdapterForStore(storeName),
     *     settings: { outputFormat: 'json' },
     *     stores: {
    *         'my-store': {
    *             kind: 'filesystem',
    *             categoryMode: 'free',
    *             categories: {},
    *             properties: { path: '/data/my-store' },
    *         },
     *     },
     * });
     * ```
     */
    static init(options: CortexOptions): Cortex {
        // Use provided adapter factory or defer to a lazy default
        const adapterFactory = options.adapterFactory ?? createDefaultAdapterFactory();
        return new Cortex({ ...options, adapterFactory });
    }

    /**
     * Returns a store client for the specified store.
     *
    * This method resolves an adapter through the configured `adapterFactory`
    * and returns a `Result` containing a `StoreClient` on success.
     *
     * @param name - The store name to get a client for
    * @returns Result containing a `StoreClient` or a `CortexClientError`
     *
     * @example
     * ```typescript
    * const storeResult = cortex.getStore('my-project');
    * if (storeResult.ok()) {
    *     const root = storeResult.value.root();
    *     const result = await root.getCategory('standards').exists();
     * } else {
    *     console.error(storeResult.error.message);
     * }
     * ```
     */
    getStore(name: string): CortexClientResult<StoreClient> {
        let adapter: StorageAdapter;
        try {
            adapter = this.adapterFactory(name);
        } catch (error) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: error instanceof Error ? error.message : `Store '${name}' not found.`,
                store: name,
            });
        }

        const client = StoreClient.init(name, adapter);
        if (!client.ok()) {
            return err({
                code: 'INVALID_STORE_ADAPTER',
                message: `Failed to create adapter for store '${name}': ${client.error.message}`,
                store: name,
                cause: client.error,
            });
        }
        return ok(client.value);
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a default adapter factory that throws until storage-fs is available.
 *
 * The actual FilesystemStorageAdapter is in the storage-fs package, which
 * depends on core. To avoid circular dependencies, we provide a factory
 * that throws a helpful error message. Users should either:
 * 1. Provide their own adapterFactory in options
 * 2. Use the pre-configured factory from storage-fs
 */
export const createDefaultAdapterFactory = (): AdapterFactory => {
    return (_storePath: string): StorageAdapter => {
        throw new Error(
            'No adapter factory provided. Either provide an adapterFactory in CortexOptions, ' +
                'or use createFilesystemCortex() from @yeseh/cortex-storage-fs.'
        );
    };
};
