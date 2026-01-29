/**
 * Filesystem index storage implementation.
 *
 * Provides file-based storage for category indexes following the
 * Interface Segregation Principle (ISP).
 *
 * @module core/storage/filesystem/index-storage
 */

import type { MemorySlugPath, Result } from '../../types.ts';
import type { IndexStorage, StorageAdapterError, StorageIndexName } from '../adapter.ts';
import type { FilesystemContext } from './types.ts';
import {
    readIndexFile,
    writeIndexFile,
    reindexCategoryIndexes,
    updateCategoryIndexes,
} from './indexes.ts';

/**
 * Filesystem-based implementation of IndexStorage.
 *
 * Handles index file I/O and reindexing operations using the local filesystem.
 * Indexes are stored as YAML files within the storage directory structure.
 *
 * @example
 * ```typescript
 * const indexStorage = new FilesystemIndexStorage(ctx);
 *
 * // Read an index file
 * const result = await indexStorage.read('project/cortex');
 * if (result.ok && result.value !== null) {
 *     console.log('Index contents:', result.value);
 * }
 *
 * // Rebuild all indexes
 * await indexStorage.reindex();
 * ```
 */
export class FilesystemIndexStorage implements IndexStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Reads the contents of an index file.
     *
     * @param name - Index identifier (category path, or empty string for root)
     * @returns Result with file contents, or null if the index does not exist
     */
    async read(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>> {
        return readIndexFile(this.ctx, name);
    }

    /**
     * Writes contents to an index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     *
     * @param name - Index identifier (category path, or empty string for root)
     * @param contents - The content to write
     * @returns Result indicating success or failure
     */
    async write(
        name: StorageIndexName,
        contents: string,
    ): Promise<Result<void, StorageAdapterError>> {
        return writeIndexFile(this.ctx, name, contents);
    }

    /**
     * Rebuilds all category indexes from the current filesystem state.
     *
     * This is a potentially expensive operation that scans all categories
     * and regenerates their index files. Use sparingly, typically for
     * repair operations or initial setup.
     *
     * @returns Result indicating success or failure
     */
    async reindex(): Promise<Result<void, StorageAdapterError>> {
        return reindexCategoryIndexes(this.ctx);
    }

    /**
     * Updates indexes after a memory write operation.
     *
     * This method handles incremental index updates when a memory file
     * is created or modified, avoiding full reindex operations.
     *
     * @param slugPath - Memory identifier path that was written
     * @param contents - The content that was written
     * @param options - Optional settings for index behavior
     * @param options.createWhenMissing - Create index entries for new categories (default: true)
     * @returns Result indicating success or failure
     */
    async updateAfterMemoryWrite(
        slugPath: MemorySlugPath,
        contents: string,
        options?: { createWhenMissing?: boolean },
    ): Promise<Result<void, StorageAdapterError>> {
        return updateCategoryIndexes(this.ctx, slugPath, contents, options);
    }
}
