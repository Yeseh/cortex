/**
 * Filesystem storage adapter module.
 *
 * Provides file-based storage for memories, indexes, and categories.
 * This is the primary storage implementation for Cortex.
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
 * // Read a memory file
 * const result = await adapter.readMemoryFile('project/cortex/config');
 * if (result.ok && result.value) {
 *     console.log(result.value);
 * }
 * ```
 */

import { resolve } from 'node:path';
import type { MemorySlugPath, Result } from '../../types.ts';
import type { StorageAdapter, StorageAdapterError, StorageIndexName } from '../adapter.ts';
import type { CategoryError } from '../../category/types.ts';
import type { CategoryIndex } from '../../index/types.ts';
import type {
    FilesystemStorageAdapterOptions,
    FilesystemContext,
    StringOrNullResult,
} from './types.ts';
import { normalizeExtension, ok } from './utils.ts';

// Import operations from focused modules
import {
    readMemoryFile as readMemoryFileOp,
    writeMemoryFile as writeMemoryFileOp,
    removeMemoryFile as removeMemoryFileOp,
    moveMemoryFile as moveMemoryFileOp,
} from './files.ts';

import {
    readIndexFile as readIndexFileOp,
    writeIndexFile as writeIndexFileOp,
    reindexCategoryIndexes as reindexCategoryIndexesOp,
    updateCategoryIndexes,
} from './indexes.ts';

import {
    categoryExists as categoryExistsOp,
    ensureCategoryDirectory as ensureCategoryDirectoryOp,
    deleteCategoryDirectory as deleteCategoryDirectoryOp,
    updateSubcategoryDescription as updateSubcategoryDescriptionOp,
    removeSubcategoryEntry as removeSubcategoryEntryOp,
    readCategoryIndexForPort,
    writeCategoryIndexForPort,
} from './categories.ts';

/**
 * Filesystem-based storage adapter for Cortex memory system.
 *
 * Implements the StorageAdapter interface using the local filesystem.
 * Memory files are stored as `.md` files and indexes as `.yaml` files.
 *
 * The adapter also implements the CategoryStoragePort interface for
 * category operations.
 */
export class FilesystemStorageAdapter implements StorageAdapter {
    private readonly ctx: FilesystemContext;

    constructor(options: FilesystemStorageAdapterOptions) {
        this.ctx = {
            storeRoot: resolve(options.rootDirectory),
            memoryExtension: normalizeExtension(options.memoryExtension, '.md'),
            indexExtension: normalizeExtension(options.indexExtension, '.yaml'),
        };
    }

    // ========================================================================
    // StorageAdapter implementation - Memory file operations
    // ========================================================================

    /**
     * Reads a memory file from the filesystem.
     *
     * @param slugPath - Path to the memory (e.g., "project/cortex/config")
     * @returns The file contents or null if not found
     */
    async readMemoryFile(slugPath: MemorySlugPath): Promise<StringOrNullResult> {
        return readMemoryFileOp(this.ctx, slugPath);
    }

    /**
     * Writes a memory file to the filesystem.
     *
     * Creates parent directories if needed. Optionally updates category indexes.
     *
     * @param slugPath - Path to the memory (e.g., "project/cortex/config")
     * @param contents - The content to write
     * @param options - Options for index handling
     */
    async writeMemoryFile(
        slugPath: MemorySlugPath,
        contents: string,
        options: { allowIndexCreate?: boolean; allowIndexUpdate?: boolean } = {}
    ): Promise<Result<void, StorageAdapterError>> {
        const writeResult = await writeMemoryFileOp(this.ctx, slugPath, contents);
        if (!writeResult.ok) {
            return writeResult;
        }

        if (options.allowIndexUpdate === false) {
            return ok(undefined);
        }

        const indexUpdate = await updateCategoryIndexes(this.ctx, slugPath, contents, {
            createWhenMissing: options.allowIndexCreate,
        });
        if (!indexUpdate.ok) {
            return indexUpdate;
        }

        return ok(undefined);
    }

    /**
     * Removes a memory file from the filesystem.
     *
     * @param slugPath - Path to the memory to remove
     */
    async removeMemoryFile(slugPath: MemorySlugPath): Promise<Result<void, StorageAdapterError>> {
        return removeMemoryFileOp(this.ctx, slugPath);
    }

    /**
     * Moves a memory file from one location to another.
     *
     * @param sourceSlugPath - Source path of the memory
     * @param destinationSlugPath - Destination path for the memory
     */
    async moveMemoryFile(
        sourceSlugPath: MemorySlugPath,
        destinationSlugPath: MemorySlugPath
    ): Promise<Result<void, StorageAdapterError>> {
        return moveMemoryFileOp(this.ctx, sourceSlugPath, destinationSlugPath);
    }

    // ========================================================================
    // StorageAdapter implementation - Index operations
    // ========================================================================

    /**
     * Reads an index file from the filesystem.
     *
     * @param name - Index name (category path, or empty string for root)
     * @returns The file contents or null if not found
     */
    async readIndexFile(name: StorageIndexName): Promise<StringOrNullResult> {
        return readIndexFileOp(this.ctx, name);
    }

    /**
     * Writes an index file to the filesystem.
     *
     * @param name - Index name (category path, or empty string for root)
     * @param contents - The content to write
     */
    async writeIndexFile(
        name: StorageIndexName,
        contents: string
    ): Promise<Result<void, StorageAdapterError>> {
        return writeIndexFileOp(this.ctx, name, contents);
    }

    /**
     * Reindexes all category indexes by scanning the filesystem.
     *
     * Walks the storage directory, collects all memory files,
     * and rebuilds all index files from scratch.
     */
    async reindexCategoryIndexes(): Promise<Result<void, StorageAdapterError>> {
        return reindexCategoryIndexesOp(this.ctx);
    }

    // ========================================================================
    // CategoryStoragePort implementation
    // ========================================================================

    /**
     * Checks if a category directory exists.
     *
     * @param path - Category path to check (e.g., "project/cortex")
     */
    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        return categoryExistsOp(this.ctx, path);
    }

    /**
     * Ensures a category directory exists, creating it if missing.
     *
     * @param path - Category path to create (e.g., "project/cortex")
     */
    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return ensureCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * @param path - Category path to delete (e.g., "project/cortex")
     */
    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return deleteCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Updates the description of a subcategory in its parent's index.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory
     * @param description - New description or null to clear
     */
    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>> {
        return updateSubcategoryDescriptionOp(this.ctx, parentPath, subcategoryPath, description);
    }

    /**
     * Removes a subcategory entry from its parent's index.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory to remove
     */
    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>> {
        return removeSubcategoryEntryOp(this.ctx, parentPath, subcategoryPath);
    }

    /**
     * Reads a category index for the CategoryStoragePort interface.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns The parsed CategoryIndex or null if not found
     */
    async readCategoryIndexForPort(
        path: string
    ): Promise<Result<CategoryIndex | null, CategoryError>> {
        return readCategoryIndexForPort(this.ctx, path);
    }

    /**
     * Writes a category index for the CategoryStoragePort interface.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @param index - The CategoryIndex to write
     */
    async writeCategoryIndexForPort(
        path: string,
        index: CategoryIndex
    ): Promise<Result<void, CategoryError>> {
        return writeCategoryIndexForPort(this.ctx, path, index);
    }
}

// Re-export types for convenience
export type { FilesystemStorageAdapterOptions, FilesystemContext } from './types.ts';
