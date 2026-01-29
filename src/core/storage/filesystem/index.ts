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
 * if (result.ok && result.value) {
 *     console.log(result.value);
 * }
 *
 * // New ISP API: Use focused storage interfaces
 * const memoryResult = await adapter.memories.read('project/cortex/config');
 * ```
 */

import { resolve } from 'node:path';
import type { MemorySlugPath, Result } from '../../types.ts';
import type {
    StorageAdapter,
    ComposedStorageAdapter,
    MemoryStorage,
    IndexStorage,
    StoreStorage,
    StorageAdapterError,
    StorageIndexName,
} from '../adapter.ts';
import type { CategoryError, CategoryStorage } from '../../category/types.ts';
import type { CategoryIndex } from '../../index/types.ts';
import type {
    FilesystemStorageAdapterOptions,
    FilesystemContext,
    StringOrNullResult,
} from './types.ts';
import { normalizeExtension, ok } from './utils.ts';

// Import ISP-compliant storage implementations
import { FilesystemMemoryStorage } from './memory-storage.ts';
import { FilesystemIndexStorage } from './index-storage.ts';
import { FilesystemCategoryStorage } from './category-storage.ts';
import { FilesystemStoreStorage } from './store-storage.ts';

// Import legacy operations needed for backward-compatible port methods
import {
    readCategoryIndexForPort,
    writeCategoryIndexForPort,
} from './categories.ts';

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
 * await adapter.memories.write('project/config', '# Config');
 * await adapter.indexes.reindex();
 *
 * // Legacy API (backward compatible)
 * await adapter.writeMemoryFile('project/config', '# Config');
 * await adapter.reindexCategoryIndexes();
 * ```
 */
export class FilesystemStorageAdapter implements StorageAdapter, ComposedStorageAdapter {
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
    /** Store registry persistence */
    public readonly stores: StoreStorage;

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
        this.stores = new FilesystemStoreStorage(this.ctx);
    }

    // ========================================================================
    // StorageAdapter (Legacy) - Memory file operations
    // ========================================================================

    /**
     * Reads a memory file from the filesystem.
     *
     * @param slugPath - Path to the memory (e.g., "project/cortex/config")
     * @returns The file contents or null if not found
     * @deprecated Use `adapter.memories.read()` instead
     */
    async readMemoryFile(slugPath: MemorySlugPath): Promise<StringOrNullResult> {
        return this.memories.read(slugPath);
    }

    /**
     * Writes a memory file to the filesystem.
     *
     * Creates parent directories if needed. Optionally updates category indexes.
     *
     * @param slugPath - Path to the memory (e.g., "project/cortex/config")
     * @param contents - The content to write
     * @param options - Options for index handling
     * @deprecated Use `adapter.memories.write()` and `adapter.indexes.updateAfterMemoryWrite()` instead
     */
    async writeMemoryFile(
        slugPath: MemorySlugPath,
        contents: string,
        options: { allowIndexCreate?: boolean; allowIndexUpdate?: boolean } = {},
    ): Promise<Result<void, StorageAdapterError>> {
        const writeResult = await this.memories.write(slugPath, contents);
        if (!writeResult.ok) {
            return writeResult;
        }

        if (options.allowIndexUpdate === false) {
            return ok(undefined);
        }

        return this.indexes.updateAfterMemoryWrite(slugPath, contents, {
            createWhenMissing: options.allowIndexCreate,
        });
    }

    /**
     * Removes a memory file from the filesystem.
     *
     * @param slugPath - Path to the memory to remove
     * @deprecated Use `adapter.memories.remove()` instead
     */
    async removeMemoryFile(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        return this.memories.remove(slugPath);
    }

    /**
     * Moves a memory file from one location to another.
     *
     * @param sourceSlugPath - Source path of the memory
     * @param destinationSlugPath - Destination path for the memory
     * @deprecated Use `adapter.memories.move()` instead
     */
    async moveMemoryFile(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath,
    ): Promise<Result<void, StorageAdapterError>> {
        return this.memories.move(sourceSlugPath, destinationSlugPath);
    }

    // ========================================================================
    // StorageAdapter (Legacy) - Index operations
    // ========================================================================

    /**
     * Reads an index file from the filesystem.
     *
     * @param name - Index name (category path, or empty string for root)
     * @returns The file contents or null if not found
     * @deprecated Use `adapter.indexes.read()` instead
     */
    async readIndexFile(name: StorageIndexName): Promise<StringOrNullResult> {
        return this.indexes.read(name);
    }

    /**
     * Writes an index file to the filesystem.
     *
     * @param name - Index name (category path, or empty string for root)
     * @param contents - The content to write
     * @deprecated Use `adapter.indexes.write()` instead
     */
    async writeIndexFile(
        name: StorageIndexName,
        contents: string,
    ): Promise<Result<void, StorageAdapterError>> {
        return this.indexes.write(name, contents);
    }

    /**
     * Reindexes all category indexes by scanning the filesystem.
     *
     * Walks the storage directory, collects all memory files,
     * and rebuilds all index files from scratch.
     * @deprecated Use `adapter.indexes.reindex()` instead
     */
    async reindexCategoryIndexes(): Promise<Result<void, StorageAdapterError>> {
        return this.indexes.reindex();
    }

    // ========================================================================
    // CategoryStoragePort (Legacy) - Category operations
    // ========================================================================

    /**
     * Checks if a category directory exists.
     *
     * @param path - Category path to check (e.g., "project/cortex")
     * @deprecated Use `adapter.categories.categoryExists()` instead
     */
    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        return this.categories.categoryExists(path);
    }

    /**
     * Ensures a category directory exists, creating it if missing.
     *
     * @param path - Category path to create (e.g., "project/cortex")
     * @deprecated Use `adapter.categories.ensureCategoryDirectory()` instead
     */
    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return this.categories.ensureCategoryDirectory(path);
    }

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * @param path - Category path to delete (e.g., "project/cortex")
     * @deprecated Use `adapter.categories.deleteCategoryDirectory()` instead
     */
    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return this.categories.deleteCategoryDirectory(path);
    }

    /**
     * Updates the description of a subcategory in its parent's index.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory
     * @param description - New description or null to clear
     * @deprecated Use `adapter.categories.updateSubcategoryDescription()` instead
     */
    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null,
    ): Promise<Result<void, CategoryError>> {
        return this.categories.updateSubcategoryDescription(
            parentPath,
            subcategoryPath,
            description,
        );
    }

    /**
     * Removes a subcategory entry from its parent's index.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory to remove
     * @deprecated Use `adapter.categories.removeSubcategoryEntry()` instead
     */
    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string,
    ): Promise<Result<void, CategoryError>> {
        return this.categories.removeSubcategoryEntry(parentPath, subcategoryPath);
    }

    /**
     * Reads a category index for the CategoryStoragePort interface.
     *
     * This method is kept for backward compatibility with existing callers
     * that expect the port-style interface.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns The parsed CategoryIndex or null if not found
     */
    async readCategoryIndexForPort(
        path: string,
    ): Promise<Result<CategoryIndex | null, CategoryError>> {
        return readCategoryIndexForPort(this.ctx, path);
    }

    /**
     * Writes a category index for the CategoryStoragePort interface.
     *
     * This method is kept for backward compatibility with existing callers
     * that expect the port-style interface.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @param index - The CategoryIndex to write
     */
    async writeCategoryIndexForPort(
        path: string,
        index: CategoryIndex,
    ): Promise<Result<void, CategoryError>> {
        return writeCategoryIndexForPort(this.ctx, path, index);
    }
}

// Re-export types for convenience
export type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';

/**
 * Focused storage implementations following the Interface Segregation Principle.
 *
 * These classes provide single-responsibility storage interfaces:
 * - {@link FilesystemMemoryStorage} - Memory file I/O operations
 * - {@link FilesystemIndexStorage} - Index file I/O and reindexing
 * - {@link FilesystemCategoryStorage} - Category directory management
 * - {@link FilesystemStoreStorage} - Store registry persistence
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
export { FilesystemStoreStorage } from './store-storage.ts';
