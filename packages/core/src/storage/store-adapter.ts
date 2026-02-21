import type { ConfigStore } from "@/config/types";
import type { StorageAdapterResult } from ".";
import type { Store, StoreResult } from "@/store";
import type { StoreData, StoreName } from "@/store/store";

/**
 * Storage interface for store registry operations.
 *
 * Handles persistence of the store registry, which maps store names
 * to their filesystem paths.
 *
 * @example
 * ```typescript
 * const result = await storage.load('~/.config/cortex/stores.yml');
 * if (result.ok) {
 *   const defaultStore = result.value['default'];
 *   console.log('Default store path:', defaultStore?.path);
 * }
 * ```
 */
export interface StoreAdapter {
    /**
     * Loads the store from backing storage 
     *
     * @param name - name of the store to load (e.g. 'default') 
     * @returns Result with the parsed Store on success, or StorageAdapterError on failure 
     */
    load(name: StoreName): Promise<StoreResult<Store | null>>;

    /**
     * Saves the store to backing storage.
     *
     * Creates parent directories as needed. Overwrites existing content.
     *
     * @param name - name of the store to save (e.g. 'default') 
     * @param store - The store data to persist
     * @returns Result indicating success or failure
     */
    save(name: StoreName, store: StoreData): Promise<StoreResult<void>>;

    /**
     * Removes a store from backing storage.
     *
     * Silently succeeds if the store does not exist.
     *
     * @param name - name of the store to remove (e.g. 'default') 
     * @returns Result indicating success or failure
     */
    remove(name: StoreName): Promise<StoreResult<void>>;
}