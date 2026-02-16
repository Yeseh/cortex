/**
 * Filesystem storage adapter module.
 *
 * Provides file-based storage for memories, indexes, and categories.
 * This is the primary storage implementation for Cortex.
 *
 * The adapter implements both the legacy `StorageAdapter` interface for
 * backward compatibility and the new `ComposedStorageAdapter` interface
 * following the Interface Segregation Principle.
 *
 * @module core/storage/filesystem
 *
 * @example
 * ```typescript
 * import { FilesystemStorageAdapter } from './filesystem';
 *
 * const adapter = new FilesystemStorageAdapter({
 *     rootDirectory: '/path/to/storage',
 * });
 *
 * // Legacy API: Read a memory file
 * const result = await adapter.readMemoryFile('project/cortex/config');
 * if (result.ok() && result.value) {
 *     console.log(result.value);
 * }
 *
 * // New ISP API: Use focused storage interfaces
 * const memoryPath = MemoryPath.fromPath('project/cortex/config');
 * if (memoryPath.ok()) {
 *   const memoryResult = await adapter.memories.read(memoryPath.value);
 * }
 * ```
 */

import { resolve } from 'node:path';
import {
    type MemoryStorage,
    type IndexStorage,
    type ScopedStorageAdapter,
} from '@yeseh/cortex-core';
import type { CategoryStorage } from '@yeseh/cortex-core/category';
import type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';
import { normalizeExtension } from './utils.ts';
// Import ISP-compliant storage implementations
import { FilesystemMemoryStorage } from './memory-storage.ts';
import { FilesystemIndexStorage } from './index-storage.ts';
import { FilesystemCategoryStorage } from './category-storage.ts';

// Import legacy operations needed for backward-compatible port methods

/**
 * Filesystem-based storage adapter for Cortex memory system.
 *
 * Implements both the legacy `StorageAdapter` interface for backward compatibility
 * and the new `ComposedStorageAdapter` interface following the Interface
 * Segregation Principle.
 *
 * Memory files are stored as `.md` files and indexes as `.yaml` files.
 *
 * @example
 * ```typescript
 * const adapter = new FilesystemStorageAdapter({ rootDirectory: '/path/to/storage' });
 *
 * // New ISP API (preferred)
 * await adapter.memories.write(memory);
 * await adapter.indexes.reindex();
 *
 * // Legacy API (backward compatible)
 * await adapter.writeMemoryFile('project/config', '# Config');
 * await adapter.reindexCategoryIndexes();
 * ```
 */
export class FilesystemStorageAdapter implements ScopedStorageAdapter {
    private readonly ctx: FilesystemContext;

    // ========================================================================
    // ComposedStorageAdapter - Focused storage interfaces
    // ========================================================================

    /** Memory file operations */
    public readonly memories: MemoryStorage;
    /** Index file operations and reindexing */
    public readonly indexes: IndexStorage;
    /** Category operations */
    public readonly categories: CategoryStorage;

    constructor(options: FilesystemStorageAdapterOptions) {
        this.ctx = {
            storeRoot: resolve(options.rootDirectory),
            memoryExtension: normalizeExtension(options.memoryExtension, '.md'),
            indexExtension: normalizeExtension(options.indexExtension, '.yaml'),
        };

        // Initialize composed storage instances
        this.memories = new FilesystemMemoryStorage(this.ctx);
        this.indexes = new FilesystemIndexStorage(this.ctx);
        this.categories = new FilesystemCategoryStorage(this.ctx);
    }
}

// Re-export types for convenience
export type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';

// Export memory serialization functions for use by core and consumers
export { parseMemory, serializeMemory } from './memories.ts';

/**
 * Creates an adapter factory for filesystem-based storage.
 *
 * This factory function creates {@link ScopedStorageAdapter} instances
 * for a given store path. It is used with {@link Cortex.fromConfig} or
 * {@link Cortex.init} to enable store resolution.
 *
 * @returns A factory function that creates scoped storage adapters
 *
 * @example
 * ```typescript
 * import { Cortex } from '@yeseh/cortex-core';
 * import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';
 *
 * // Use with Cortex.fromConfig
 * const result = await Cortex.fromConfig(
 *     '~/.config/cortex',
 *     createFilesystemAdapterFactory()
 * );
 *
 * // Use with Cortex.init for testing
 * const cortex = Cortex.init({
 *     rootDirectory: '/tmp/test',
 *     registry: { test: { path: '/tmp/store' } },
 *     adapterFactory: createFilesystemAdapterFactory(),
 * });
 * ```
 */
export const createFilesystemAdapterFactory = (): ((storePath: string) => ScopedStorageAdapter) => {
    return (storePath: string): ScopedStorageAdapter => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storePath });
        return {
            memories: adapter.memories,
            indexes: adapter.indexes,
            categories: adapter.categories,
        };
    };
};

/**
 * Focused storage implementations following the Interface Segregation Principle.
 *
 * These classes provide single-responsibility storage interfaces:
 * - {@link FilesystemMemoryStorage} - Memory file I/O operations
 * - {@link FilesystemIndexStorage} - Index file I/O and reindexing
 * - {@link FilesystemCategoryStorage} - Category directory management
 *
 * New code should prefer these focused interfaces over the legacy
 * {@link FilesystemStorageAdapter} methods for better testability
 * and clearer dependencies.
 *
 * @example
 * ```typescript
 * // Prefer focused interfaces for new code
 * import {
 *     FilesystemMemoryStorage,
 *     FilesystemIndexStorage
 * } from './filesystem';
 *
 * function writeMemoryWithIndex(
 *     memories: MemoryStorage,
 *     indexes: IndexStorage,
 *     path: string,
 *     content: string
 * ) {
 *     await memories.write(path, content);
 *     await indexes.updateAfterMemoryWrite(path, content);
 * }
 * ```
 */
export { FilesystemMemoryStorage } from './memory-storage.ts';
export { FilesystemIndexStorage } from './index-storage.ts';
export { FilesystemCategoryStorage } from './category-storage.ts';
