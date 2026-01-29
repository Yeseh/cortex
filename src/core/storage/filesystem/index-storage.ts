/**
 * Filesystem index storage implementation.
 *
 * Provides file-based storage for category indexes following the
 * Interface Segregation Principle (ISP). Category indexes maintain
 * metadata about memories within each category, enabling efficient
 * listing and search operations.
 *
 * @module core/storage/filesystem/index-storage
 * @see {@link IndexStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - Related memory storage implementation
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
 * Filesystem-based implementation of the IndexStorage interface.
 *
 * Handles index file I/O and reindexing operations using the local filesystem.
 * Indexes are stored as YAML files within the storage directory structure,
 * with one index file per category (including the root).
 *
 * The index file format is defined by the CategoryIndex type and contains:
 * - Memory entries with slugs, tags, and expiration dates
 * - Subcategory entries with optional descriptions
 *
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/storage',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 *
 * const indexStorage = new FilesystemIndexStorage(ctx);
 *
 * // Read a category index
 * const result = await indexStorage.read('project/cortex');
 * if (result.ok && result.value !== null) {
 *     console.log('Index contents:', result.value);
 * }
 *
 * // Update index after writing a memory
 * await indexStorage.updateAfterMemoryWrite(
 *     'project/cortex/architecture',
 *     '# Architecture\n...',
 *     { createWhenMissing: true }
 * );
 *
 * // Rebuild all indexes (expensive operation)
 * await indexStorage.reindex();
 * ```
 *
 * @see {@link IndexStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - Related memory storage implementation
 */
export class FilesystemIndexStorage implements IndexStorage {
    /**
     * Creates a new FilesystemIndexStorage instance.
     *
     * @param ctx - Filesystem context containing storage root and file extensions
     */
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Reads the contents of a category index file.
     *
     * Index files contain YAML-formatted category metadata including
     * memory entries and subcategory references.
     *
     * @param name - Index identifier (category path, or empty string for root index)
     * @returns Result with file contents as a string, or null if the index does not exist
     *
     * @example
     * ```typescript
     * // Read root index
     * const rootResult = await storage.read('');
     *
     * // Read category index
     * const categoryResult = await storage.read('project/cortex');
     * ```
     */
    async read(name: StorageIndexName): Promise<Result<string | null, StorageAdapterError>> {
        return readIndexFile(this.ctx, name);
    }

    /**
     * Writes contents to a category index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     * Parent directories are created as needed.
     *
     * @param name - Index identifier (category path, or empty string for root index)
     * @param contents - The YAML content to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const yamlContent = `memories:
     *   - slug: architecture
     *     tags: [design, overview]
     * subcategories:
     *   - path: project/cortex/decisions
     * `;
     * await storage.write('project/cortex', yamlContent);
     * ```
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
