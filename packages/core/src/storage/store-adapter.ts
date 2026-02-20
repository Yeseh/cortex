import type { StorageAdapterResult } from ".";
import type { Store, StoreResult } from "@/store";
import type { StoreName } from "@/store/store";

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
    save(name: StoreName, store: Store): Promise<StoreResult<void>>;

    /**
     * Removes a store from backing storage.
     *
     * Silently succeeds if the store does not exist.
     *
     * @param name - name of the store to remove (e.g. 'default') 
     * @returns Result indicating success or failure
     */
    remove(name: StoreName): Promise<StoreResult<void>>;

    /**
     * Adds a new store to the registry and persists it.
     *
     * @param name - The store name to add
     * @param store - The store data to persist
     * @returns Result indicating success or failure
     */
    add(name: StoreName, store: Store): Promise<StoreResult<void>>;
}