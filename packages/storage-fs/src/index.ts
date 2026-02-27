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
 * import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
 * import { MemoryPath } from '@yeseh/cortex-core';
 *
 * const adapter = new FilesystemStorageAdapter({
 *     rootDirectory: '/path/to/storage',
 * });
 *
 * // Load a memory using the ISP API
 * const memoryPath = MemoryPath.fromString('project/cortex/config');
 * if (memoryPath.ok()) {
 *   const result = await adapter.memories.load(memoryPath.value);
 *   if (result.ok() && result.value) {
 *     console.log(result.value);
 *   }
 * }
 * ```
 */

import { resolve } from 'node:path';
import {
    type MemoryStorage,
    type IndexStorage,
    type CategoryStorage,
    type StorageAdapter,
    type ConfigAdapter,
} from '@yeseh/cortex-core';
import type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';
import { normalizeExtension } from './utils.ts';
// Import ISP-compliant storage implementations
import { FilesystemMemoryAdapter } from './memory-adapter.ts';
import { FilesystemIndexAdapter } from './index-adapter.ts';
import { FilesystemCategoryAdapter } from './category-adapter.ts';

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
export class FilesystemStorageAdapter implements StorageAdapter {
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
    public readonly config: ConfigAdapter;

    constructor(configAdapter: ConfigAdapter, options: FilesystemStorageAdapterOptions) {
        this.ctx = {
            storeRoot: resolve(options.rootDirectory),
            memoryExtension: normalizeExtension(options.memoryExtension, '.md'),
            indexExtension: normalizeExtension(options.indexExtension, '.yaml'),
        };

        // Initialize composed storage instances
        this.memories = new FilesystemMemoryAdapter(this.ctx);
        this.indexes = new FilesystemIndexAdapter(this.ctx);
        this.categories = new FilesystemCategoryAdapter(this.ctx);
        this.config = configAdapter;
    }
}

// Re-export types for convenience
export type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';

// Export memory serialization functions for use by core and consumers
export { parseMemory, serializeMemory } from './memories.ts';

/**
 * Focused storage implementations following the Interface Segregation Principle.
 *
 * These classes provide single-responsibility storage interfaces:
 * - {@link FilesystemMemoryStorage} - Memory file I/O operations
 * - {@link FilesystemIndexStorage} - Index file I/O and reindexing
 * - {@link FilesystemCategoryStorage} - Category directory management
 * - {@link FilesystemStoreAdapter} - Store configuration persistence
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
export { FilesystemMemoryAdapter } from './memory-adapter.ts';
export { FilesystemIndexAdapter } from './index-adapter.ts';
export { FilesystemCategoryAdapter } from './category-adapter.ts';
export { FilesystemConfigAdapter } from './config-adapter.ts';
