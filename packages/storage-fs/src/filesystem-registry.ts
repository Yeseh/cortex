/**
 * Filesystem implementation of the Registry interface.
 *
 * Manages store registry persistence using a YAML file and provides a factory
 * for obtaining storage adapters scoped to specific stores. The registry maps
 * store names to their filesystem paths and optional metadata.
 *
 * **Lifecycle:**
 * 1. Create instance with path to registry file
 * 2. Call {@link initialize} once for first-time setup (creates file if missing)
 * 3. Call {@link load} to read and cache registry data
 * 4. Use {@link getStore} synchronously to obtain store-specific adapters
 * 5. Call {@link save} when registry changes need to be persisted
 *
 * @module core/storage/filesystem/filesystem-registry
 * @see {@link Registry} - The interface this class implements
 * @see {@link StorageAdapter} - The adapter type returned by getStore
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
    err,
    getDefaultSettings,
    ok,
    parseConfig,
    type Result,
} from '@yeseh/cortex-core';
import type { RegistryAdapter, RegistryError, StorageAdapter } from '@yeseh/cortex-core';
import type { CortexSettings } from '../../core/src/config/types.ts';

/**
 * Checks if an error is a "file not found" error (ENOENT).
 *
 * @param error - The error to check
 * @returns True if the error indicates a missing file
 */
const isNotFoundError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    if (!('code' in error)) {
        return false;
    }
    return (error as { code?: string }).code === 'ENOENT';
};

/**
 * Filesystem-based implementation of the Registry interface.
 *
 * Manages the store registry file and provides a factory for obtaining
 * storage adapters scoped to specific stores. The registry maps store
 * names to their filesystem paths.
 *
 * **Thread safety:** This implementation is not thread-safe. Concurrent
 * modifications from multiple processes may cause data loss. Use file
 * locking at the application level if concurrent access is required.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const registry = new FilesystemRegistry('/home/user/.config/cortex/stores.yaml');
 * await registry.initialize(); // First-time setup
 * await registry.load();
 *
 * const adapter = registry.getStore('my-project');
 * if (adapter.ok()) {
 *   const memory = await adapter.value.memories.read('category/memory');
 *   console.log(memory.value);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Adding a new store
 * const registry = new FilesystemRegistry('/config/stores.yaml');
 * const current = await registry.load();
 * if (current.ok()) {
 *   await registry.save({
 *     ...current.value,
 *     'new-store': { path: '/data/new-store' }
 *   });
 * }
 * ```
 */
export class FilesystemRegistry implements RegistryAdapter {
    /** Cached settings data, populated by load() */
    private settingsCache: CortexSettings | null = null;

    /**
     * Creates a new FilesystemRegistry instance.
     *
     * Does not perform any I/O. Call {@link initialize} or {@link load}
     * to interact with the filesystem.
     *
     * @param configPath - Absolute filesystem path to the config YAML file
     *
     * @example
     * ```typescript
     * const registry = new FilesystemRegistry('/home/user/.config/cortex/config.yaml');
     * ```
     */
    constructor(private readonly configPath: string) {}

    /**
     * Get the loaded settings.
     * Returns default settings if not loaded.
     */
    getSettings(): CortexSettings {
        return this.settingsCache ?? getDefaultSettings();
    }

    /**
     * First-time registry setup.
     *
     * Creates the registry file with an empty store list if it doesn't exist.
     * Creates parent directories as needed. Safe to call if registry already
     * exists - in that case, this is a no-op.
     *
     * @returns Result with void on success, or RegistryError on failure
     *
     * @example
     * ```typescript
     * const result = await registry.initialize();
     * if (result.ok()) {
     *   console.log('Registry ready');
     * } else if (result.error.code === 'REGISTRY_WRITE_FAILED') {
     *   console.error('Permission denied:', result.error.path);
     * }
     * ```
     */
    async initialize(): Promise<Result<void, RegistryError>> {
        try {
            // Check if file exists
            try {
                await readFile(this.configPath, 'utf8');
                // File exists, nothing to do
                return ok(undefined);
            }
            catch (error) {
                if (!isNotFoundError(error)) {
                    return err({
                        code: 'REGISTRY_READ_FAILED',
                        message: `Failed to check config at ${this.configPath}`,
                        path: this.configPath,
                        cause: error,
                    });
                }
                // File doesn't exist, continue to create it
            }

            // Create parent directories
            await mkdir(dirname(this.configPath), { recursive: true });

            // Create default config with settings and empty stores
            const defaultConfig = getDefaultSettings(); 
            const yaml = Bun.YAML.stringify(defaultConfig);
            await writeFile(this.configPath, yaml, 'utf8');

            return ok(undefined);
        }
        catch (error) {
            return err({
                code: 'REGISTRY_WRITE_FAILED',
                message: `Failed to initialize config at ${this.configPath}`,
                path: this.configPath,
                cause: error,
            });
        }
    }
}

