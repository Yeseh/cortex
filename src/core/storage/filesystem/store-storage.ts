/**
 * Filesystem implementation of StoreStorage interface.
 *
 * Provides store registry persistence operations delegating to
 * the existing registry functions.
 *
 * @module core/storage/filesystem/store-storage
 */

import type { Result } from '../../types.ts';
import type { StoreStorage } from '../adapter.ts';
import type { FilesystemContext } from './types.ts';
import type {
    StoreRegistry,
    StoreRegistryLoadError,
    StoreRegistrySaveError,
} from '../../store/registry.ts';
import {
    loadStoreRegistry,
    saveStoreRegistry,
    removeStoreRegistry,
} from '../../store/registry.ts';

/**
 * Filesystem-based implementation of StoreStorage.
 *
 * Delegates all operations to the existing registry functions
 * from `../../store/registry.ts`.
 */
export class FilesystemStoreStorage implements StoreStorage {
    /**
     * Context may be useful for future enhancements.
     * Currently unused but kept for API consistency with other
     * filesystem storage implementations.
     */
    constructor(private readonly _ctx: FilesystemContext) {}

    /**
     * Loads the store registry from a file.
     *
     * @param path - Filesystem path to the registry file
     * @param options - Optional loading settings
     * @returns Result with the parsed registry or an error
     */
    async load(
        path: string,
        options?: { allowMissing?: boolean },
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>> {
        return loadStoreRegistry(path, options);
    }

    /**
     * Saves the store registry to a file.
     *
     * @param path - Filesystem path to write the registry
     * @param registry - The registry data to persist
     * @returns Result indicating success or failure
     */
    async save(
        path: string,
        registry: StoreRegistry,
    ): Promise<Result<void, StoreRegistrySaveError>> {
        return saveStoreRegistry(path, registry);
    }

    /**
     * Removes a store registry file.
     *
     * @param path - Filesystem path to the registry file
     * @returns Result indicating success or failure
     */
    async remove(path: string): Promise<Result<void, StoreRegistrySaveError>> {
        return removeStoreRegistry(path);
    }
}
