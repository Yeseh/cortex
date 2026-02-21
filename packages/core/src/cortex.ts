/**
 * Cortex - Root client for the memory system.
 *
 * Provides the main entry point for creating and managing Cortex instances.
 * Supports both programmatic creation via `init()` and config-file-based
 * creation via `fromConfig()`.
 *
 * @module core/cortex/cortex
 *
 * @example
 * ```typescript
 * // Create programmatically (for testing or embedded use)
 * const cortex = Cortex.init({
 *     rootDirectory: '/path/to/config',
 *     registry: { 'my-store': { path: '/path/to/store' } },
 * });
 *
 * // Get a store client
 * const store = cortex.getStore('my-store');
 * if (store.ok()) {
 *     const root = store.value.rootCategory();
 *     const result = await root.getCategory('standards').exists();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Load from config file
 * const result = await Cortex.fromConfig('~/.config/cortex');
 * if (result.ok()) {
 *     const cortex = result.value;
 *     console.log('Loaded stores:', Object.keys(cortex.registry));
 * }
 * ```
 */

import type { StorageAdapter } from '@/storage/index.ts';
import {
    type CortexOptions,
    type AdapterFactory,
} from './types.ts';
import { StoreClient, type StoreClientResult } from './store/store-client.ts';
import { getDefaultSettings } from '@/config/config.ts';
import type {  CortexSettings, ConfigStores } from '@/config/types.ts';
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
 * The Cortex class manages configuration, store registry, and provides
 * factory access to scoped storage adapters for each registered store.
 *
 * **Creation patterns:**
 * - `Cortex.init(options)` - Synchronous, programmatic creation
 *
 * **Lifecycle:**
 * 1. Create via `init()` or `fromConfig()`
 * 2. Optionally call `initialize()` to create folder structure
 * 3. Use `getStore(name)` to get adapters for specific stores
 */
export class Cortex {
    /** Current runtime settings */
    public readonly settings: CortexSettings;

    /** Factory for creating scoped storage adapters */
    private readonly adapterFactory: AdapterFactory;

    /**
     * Private constructor - use `Cortex.init()` or `Cortex.fromConfig()`.
     */
    private constructor(options: CortexOptions) {
        this.settings = { ...getDefaultSettings(), ...options.settings };
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
     * // Minimal usage with defaults
     * const cortex = Cortex.init({ rootDirectory: '/path/to/config' });
     *
     * // With custom settings and registry
     * const cortex = Cortex.init({
     *     rootDirectory: '/path/to/config',
     *     settings: { outputFormat: 'json' },
     *     registry: {
     *         'my-store': { path: '/data/my-store' },
     *     },
     * });
     *
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
     * The client provides access to store metadata and category operations.
     * Adapters are cached internally for reuse.
     *
     * Uses lazy validation: the StoreClient is always returned synchronously,
     * but operations (rootCategory(), getAdapter()) will throw if the store
     * doesn't exist. Use store.exists() to check validity before operations.
     *
     * @param name - The store name to get a client for
     * @returns A StoreClient for the store (throws on operations if not found)
     *
     * @example
     * ```typescript
     * // Always returns a StoreClient (lazy validation)
     * const store = cortex.getStore('my-project');
     * console.log(store.name);  // 'my-project'
     *
     * // Check if store exists before operations
     * if (store.exists()) {
     *     const root = store.rootCategory();
     *     const result = await root.getCategory('standards').exists();
     * } else {
     *     console.error('Store not found:', store.getError()?.message);
     * }
     *
     * // Or use try/catch for operations
     * try {
     *     const root = store.rootCategory();
     * } catch (e) {
     *     console.error('Store not found:', e.message);
     * }
     * ```
     */
    getStore(name: string): CortexClientResult<StoreClient> {
        const adapter = this.adapterFactory(name);
        const storeClient = StoreClient.init(
            name, 
            adapter);

        if (!storeClient.ok()) {
             return err({
                code: 'INVALID_STORE_ADAPTER',
                message: `Adapter was null or undefined for store '${name}'`,
                store: name,
             });
        }

        return ok(storeClient.value);
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
                'or use createFilesystemCortex() from @yeseh/cortex-storage-fs.',
        );
    };
};

