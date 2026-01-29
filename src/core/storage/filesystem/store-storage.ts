/**
 * Filesystem implementation of the StoreStorage interface.
 *
 * Provides store registry persistence operations delegating to
 * the existing registry functions. The registry maps store names
 * to their filesystem paths, allowing multiple named stores.
 *
 * @module core/storage/filesystem/store-storage
 * @see {@link StoreStorage} - The interface this class implements
 * @see {@link StoreRegistry} - The registry data structure
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
 * Filesystem-based implementation of the StoreStorage interface.
 *
 * Manages persistence of the store registry, which maps logical store names
 * to filesystem paths. The registry file is typically stored in a user's
 * config directory (e.g., `~/.config/cortex/stores.yaml`).
 *
 * This class delegates to the registry functions in `../../store/registry.ts`,
 * providing an object-oriented interface that fits the ISP storage pattern.
 *
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/storage',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 *
 * const storeStorage = new FilesystemStoreStorage(ctx);
 *
 * // Load existing registry
 * const loadResult = await storeStorage.load('~/.config/cortex/stores.yaml');
 * if (loadResult.ok) {
 *     console.log('Stores:', Object.keys(loadResult.value));
 * }
 *
 * // Save updated registry
 * const registry = { default: { path: '/home/user/.cortex' } };
 * await storeStorage.save('~/.config/cortex/stores.yaml', registry);
 * ```
 *
 * @see {@link StoreStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - Related ISP storage implementation
 */
export class FilesystemStoreStorage implements StoreStorage {
    /**
     * Creates a new FilesystemStoreStorage instance.
     *
     * Note: The context is currently unused but kept for API consistency
     * with other filesystem storage implementations, allowing future
     * enhancements without breaking changes.
     *
     * @param _ctx - Filesystem context (reserved for future use)
     */
    constructor(private readonly _ctx: FilesystemContext) {}

    /**
     * Loads the store registry from a YAML file.
     *
     * Reads and parses the store registry from the specified path.
     * The registry maps store names to their configuration.
     *
     * @param path - Filesystem path to the registry file (e.g., "~/.config/cortex/stores.yaml")
     * @param options - Optional loading settings
     * @param options.allowMissing - If true, returns an empty registry when the file doesn't exist
     *                               instead of an error (default: false)
     * @returns Result with the parsed registry, or an error if loading failed
     *
     * @example
     * ```typescript
     * // Load with error on missing file
     * const result = await storage.load('/path/to/stores.yaml');
     *
     * // Load with fallback to empty registry
     * const result = await storage.load('/path/to/stores.yaml', { allowMissing: true });
     * if (result.ok) {
     *     const stores = Object.keys(result.value);
     * }
     * ```
     */
    async load(
        path: string,
        options?: { allowMissing?: boolean },
    ): Promise<Result<StoreRegistry, StoreRegistryLoadError>> {
        return loadStoreRegistry(path, options);
    }

    /**
     * Saves the store registry to a YAML file.
     *
     * Serializes the registry and writes it to the specified path.
     * Creates parent directories as needed.
     *
     * @param path - Filesystem path to write the registry
     * @param registry - The registry data to persist
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const registry = {
     *     default: { path: '/home/user/.cortex' },
     *     work: { path: '/projects/work/.cortex' }
     * };
     * const result = await storage.save('/path/to/stores.yaml', registry);
     * if (!result.ok) {
     *     console.error('Failed to save:', result.error);
     * }
     * ```
     */
    async save(
        path: string,
        registry: StoreRegistry,
    ): Promise<Result<void, StoreRegistrySaveError>> {
        return saveStoreRegistry(path, registry);
    }

    /**
     * Removes a store registry file from the filesystem.
     *
     * Silently succeeds if the file does not exist.
     *
     * @param path - Filesystem path to the registry file to remove
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Clean up registry file
     * await storage.remove('/path/to/stores.yaml');
     * ```
     */
    async remove(path: string): Promise<Result<void, StoreRegistrySaveError>> {
        return removeStoreRegistry(path);
    }
}
