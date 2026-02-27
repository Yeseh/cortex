import type { Store, StoreResult } from '@/store';
import type { StoreData, StoreName } from '@/store/store';

/**
 * Storage interface for per-store metadata operations.
 *
 * Handles loading, saving, and removing store metadata records keyed by store name.
 *
 * @example
 * ```typescript
 * const result = await storage.load('default');
 * if (result.ok()) {
 *   console.log('Store found:', result.value?.kind);
 * }
 * ```
 */
export interface StoreAdapter {
    /**
        * Loads store metadata from backing storage.
     *
        * @param name - Name of the store to load (e.g., `default`)
        * @returns Result with the parsed store data, `null` when absent, or a storage error
     */
    load(name: StoreName): Promise<StoreResult<Store | null>>;

    /**
     * Saves the store to backing storage.
     *
     * Creates parent directories as needed. Overwrites existing content.
     *
    * @param name - Name of the store to save (e.g., `default`)
     * @param store - The store data to persist
     * @returns Result indicating success or failure
     */
    save(name: StoreName, store: StoreData): Promise<StoreResult<void>>;

    /**
     * Removes a store from backing storage.
     *
     * Silently succeeds if the store does not exist.
     *
    * @param name - Name of the store to remove (e.g., `default`)
     * @returns Result indicating success or failure
     */
    remove(name: StoreName): Promise<StoreResult<void>>;
}
