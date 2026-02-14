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
 * @see {@link ScopedStorageAdapter} - The adapter type returned by getStore
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { err, ok, type Result } from '@yeseh/cortex-core';
import type { Registry, RegistryError, ScopedStorageAdapter, StoreNotFoundError } from '@yeseh/cortex-core/storage';
import type { StoreRegistry } from '@yeseh/cortex-core/store';
import { parseStoreRegistry, serializeStoreRegistry } from '@yeseh/cortex-core/store';
import { FilesystemStorageAdapter } from './index.ts';

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
export class FilesystemRegistry implements Registry {
    /** Cached registry data, populated by load() */
    private cache: StoreRegistry | null = null;

    /**
     * Creates a new FilesystemRegistry instance.
     *
     * Does not perform any I/O. Call {@link initialize} or {@link load}
     * to interact with the filesystem.
     *
     * @param registryPath - Absolute filesystem path to the registry YAML file
     *
     * @example
     * ```typescript
     * const registry = new FilesystemRegistry('/home/user/.config/cortex/stores.yaml');
     * ```
     */
    constructor(private readonly registryPath: string) {}

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
                await readFile(this.registryPath, 'utf8');
                // File exists, nothing to do
                return ok(undefined);
            }
            catch (error) {
                if (!isNotFoundError(error)) {
                    return err({
                        code: 'REGISTRY_READ_FAILED',
                        message: `Failed to check registry at ${this.registryPath}`,
                        path: this.registryPath,
                        cause: error,
                    });
                }
                // File doesn't exist, continue to create it
            }

            // Create parent directories
            await mkdir(dirname(this.registryPath), { recursive: true });

            // Create empty registry - write a minimal valid YAML structure
            // Note: parseStoreRegistry requires at least one store, but for
            // initialization we write the structure that can be extended
            const minimalYaml = 'stores:\n';
            await writeFile(this.registryPath, minimalYaml, 'utf8');

            return ok(undefined);
        }
        catch (error) {
            return err({
                code: 'REGISTRY_WRITE_FAILED',
                message: `Failed to initialize registry at ${this.registryPath}`,
                path: this.registryPath,
                cause: error,
            });
        }
    }

    /**
     * Loads the store registry from the filesystem and caches it internally.
     *
     * Must be called before {@link getStore} can be used. Subsequent calls
     * refresh the cache, which is useful when the registry file may have
     * been modified by another process.
     *
     * **Error codes:**
     * - `REGISTRY_MISSING` - File does not exist (run initialize first)
     * - `REGISTRY_READ_FAILED` - I/O error reading file
     * - `REGISTRY_PARSE_FAILED` - File contains invalid YAML
     *
     * @returns Result with the parsed StoreRegistry, or RegistryError on failure
     *
     * @example
     * ```typescript
     * const result = await registry.load();
     * if (result.ok()) {
     *   console.log('Loaded stores:', Object.keys(result.value));
     * } else if (result.error.code === 'REGISTRY_MISSING') {
     *   await registry.initialize();
     *   await registry.load();
     * }
     * ```
     */
    async load(): Promise<Result<StoreRegistry, RegistryError>> {
        let contents: string;
        try {
            contents = await readFile(this.registryPath, 'utf8');
        }
        catch (error) {
            if (isNotFoundError(error)) {
                return err({
                    code: 'REGISTRY_MISSING',
                    message: `Store registry not found at ${this.registryPath}`,
                    path: this.registryPath,
                });
            }
            return err({
                code: 'REGISTRY_READ_FAILED',
                message: `Failed to read store registry at ${this.registryPath}`,
                path: this.registryPath,
                cause: error,
            });
        }

        const parsed = parseStoreRegistry(contents);
        if (!parsed.ok()) {
            return err({
                code: 'REGISTRY_PARSE_FAILED',
                message: `Failed to parse store registry at ${this.registryPath}`,
                path: this.registryPath,
                cause: parsed.error,
            });
        }

        this.cache = parsed.value;
        return ok(parsed.value);
    }

    /**
     * Saves the store registry to the filesystem.
     *
     * Creates parent directories as needed. Overwrites existing content.
     * Also updates the internal cache so subsequent {@link getStore} calls
     * reflect the new data.
     *
     * @param registry - The complete registry data to persist
     * @returns Result with void on success, or RegistryError on failure
     *
     * @example
     * ```typescript
     * // Remove a store from the registry
     * const { deletedStore, ...remaining } = currentRegistry;
     * const result = await registry.save(remaining);
     * if (!result.ok()) {
     *   console.error('Save failed:', result.error.message);
     * }
     * ```
     */
    async save(registry: StoreRegistry): Promise<Result<void, RegistryError>> {
        const serialized = serializeStoreRegistry(registry);
        if (!serialized.ok()) {
            return err({
                code: 'REGISTRY_WRITE_FAILED',
                message: 'Failed to serialize store registry',
                path: this.registryPath,
                cause: serialized.error,
            });
        }

        try {
            await mkdir(dirname(this.registryPath), { recursive: true });
            await writeFile(this.registryPath, serialized.value, 'utf8');
            this.cache = registry;
            return ok(undefined);
        }
        catch (error) {
            return err({
                code: 'REGISTRY_WRITE_FAILED',
                message: `Failed to write store registry at ${this.registryPath}`,
                path: this.registryPath,
                cause: error,
            });
        }
    }

    /**
     * Returns a storage adapter scoped to the specified store.
     *
     * This is a synchronous operation that uses the cached registry data
     * from the last {@link load} call. The returned adapter provides access
     * to memory, index, and category operations within the store.
     *
     * @param name - The store name to get an adapter for
     * @returns Result with ScopedStorageAdapter on success, or StoreNotFoundError if not found
     * @throws Error if {@link load} has not been called (cache is null)
     *
     * @example
     * ```typescript
     * await registry.load(); // Required before getStore
     *
     * const adapter = registry.getStore('my-project');
     * if (adapter.ok()) {
     *   // Read a memory
     *   const memory = await adapter.value.memories.read('notes/todo');
     *
     *   // Write a memory
     *   await adapter.value.memories.write('notes/new', '# New Note');
     *
     *   // Reindex the store
     *   await adapter.value.indexes.reindex();
     * } else {
     *   console.error(`Store '${adapter.error.store}' not found`);
     * }
     * ```
     */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
        if (!this.cache) {
            throw new Error('Registry not loaded. Call load() first.');
        }

        const store = this.cache[name];
        if (!store) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${name}' is not registered. Use 'cortex store list' to see available stores.`,
                store: name,
            });
        }

        // Create FilesystemStorageAdapter scoped to store path
        const adapter = new FilesystemStorageAdapter({ rootDirectory: store.path });
        return ok({
            memories: adapter.memories,
            indexes: adapter.indexes,
            categories: adapter.categories,
        });
    }
}

