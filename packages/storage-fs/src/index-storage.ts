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

import type { CategoryPath, Result } from '@yeseh/cortex-core';
import { err, ok, type Memory } from '@yeseh/cortex-core';
import type { IndexAdapter, ReindexResult, StorageAdapterError } from '@yeseh/cortex-core';
import type { Category } from '@yeseh/cortex-core/category';
import type { FilesystemContext } from './types.ts';
import {
    readIndexFile,
    writeIndexFile,
    reindexCategoryIndexes,
    updateCategoryIndexesFromMemory,
} from './indexes.ts';
import { parseIndex, serializeIndex } from './index-serialization.ts';

/**
 * Filesystem-based implementation of the IndexStorage interface.
 *
 * Handles index file I/O and reindexing operations using the local filesystem.
 * Indexes are stored as YAML files within the storage directory structure,
 * with one index file per category (including the root).
 *
 * The index file format is defined by the Category type and contains:
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
 * if (result.ok() && result.value !== null) {
 *     console.log('Index contents:', result.value);
 * }
 *
 * // Update index after writing a memory
 * await indexStorage.updateAfterMemoryWrite(memory, { createWhenMissing: true });
 *
 * // Rebuild all indexes (expensive operation)
 * await indexStorage.reindex();
 * ```
 *
 * @see {@link IndexStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - Related memory storage implementation
 */
export class FilesystemIndexStorage implements IndexAdapter {
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
     * @returns Result with parsed Category, or null if the index does not exist
     *
     * @example
     * ```typescript
     * // Read root index
     * const rootResult = await storage.read('');
     *
     * // Read category index
     * const categoryResult = await storage.read('project/cortex');
     * ```
     *
     * @edgeCases
     * - Passing an empty string reads the root index file.
     * - Missing index files return `ok(null)` rather than an error.
     */
    async read(name: CategoryPath): Promise<Result<Category | null, StorageAdapterError>> {
        const contents = await readIndexFile(this.ctx, name);
        if (!contents.ok()) {
            return contents;
        }
        if (!contents.value) {
            return ok(null);
        }

        const parsed = parseIndex(contents.value);
        if (!parsed.ok()) {
            return err({
                code: 'INDEX_ERROR',
                message: `Failed to parse category index at ${name}.`,
                path: name.toString(),
                cause: parsed.error,
            });
        }
        return ok(parsed.value);
    }

    /**
     * Reads the deprecated index file API.
     *
     * This method returns the structured {@link Category} (or null when
     * missing), not raw YAML contents. It is retained for compatibility only.
     *
     * @deprecated Prefer {@link read} which returns structured data.
     */
    async readIndexFile(
        name: CategoryPath,
    ): Promise<Result<Category | null, StorageAdapterError>> {
        return this.read(name);
    }

    /**
     * Writes contents to a category index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     * Parent directories are created as needed.
     *
     * @param name - Index identifier (category path, or empty string for root index)
     * @param contents - The Category to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const index: Category = {
     *   memories: [{ path: 'project/cortex/architecture', tokenEstimate: 120 }],
     *   subcategories: [{ path: 'project/cortex/decisions', memoryCount: 3 }],
     * };
     * await storage.write('project/cortex', index);
     * ```
     *
     * @edgeCases
     * - Writing to the root index uses `''` as the name.
     * - Serialization failures surface as `INDEX_ERROR` results.
     */
    async write(
        name: CategoryPath,
        contents: Category,
    ): Promise<Result<void, StorageAdapterError>> {
        const serialized = serializeIndex(contents);
        if (!serialized.ok()) {
            return err({
                code: 'INDEX_ERROR',
                message: `Failed to serialize category index at ${name}.`,
                path: name.toString(),
                cause: serialized.error,
            });
        }
        return writeIndexFile(this.ctx, name, serialized.value);
    }

    /**
     * Writes the deprecated index file API.
     *
     * This method accepts a structured {@link Category}, not raw YAML
     * contents. It is retained for compatibility only.
     *
     * @deprecated Prefer {@link write} which accepts structured data.
     */
    async writeIndexFile(
        name: CategoryPath,
        contents: Category,
    ): Promise<Result<void, StorageAdapterError>> {
        return this.write(name, contents);
    }

    /**
     * Rebuilds category indexes from the current filesystem state.
     *
     * This is a potentially expensive operation that scans categories
     * and regenerates their index files. Use sparingly, typically for
     * repair operations or initial setup.
     *
     * @param scope - The category scope to reindex. Pass CategoryPath.root()
     *                for store-wide reindexing. Non-root scopes only rebuild
     *                indexes for categories under that path.
     * @returns Result with warnings array, or error on failure
     *
     * @example
     * ```typescript
     * // Reindex entire store
     * const result = await storage.reindex(CategoryPath.root());
     *
     * // Reindex only 'standards' subtree
     * const scope = CategoryPath.fromString('standards').value;
     * const result = await storage.reindex(scope);
     * ```
     *
     * @edgeCases
     * - Large stores can take noticeable time; consider running off the hot path.
     * - Slug collisions and skipped files are reported via `warnings`.
     */
    async reindex(scope: CategoryPath): Promise<Result<ReindexResult, StorageAdapterError>> {
        return reindexCategoryIndexes(this.ctx, scope);
    }

    /**
     * Updates indexes after a memory write operation.
     *
     * This method handles incremental index updates when a memory file
     * is created or modified, avoiding full reindex operations.
     *
     * @param memory - The memory object that was written
     * @param options - Optional settings for index behavior
     * @param options.createWhenMissing - Create index entries for new categories (default: true)
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.updateAfterMemoryWrite(memory);
     * ```
     *
     * @edgeCases
     * - Invalid slug paths return `INDEX_ERROR` without updating any indexes.
     * - Set `createWhenMissing` to false to avoid creating new indexes.
     */
    async updateAfterMemoryWrite(
        memory: Memory,
        options?: { createWhenMissing?: boolean },
    ): Promise<Result<void, StorageAdapterError>> {
        return updateCategoryIndexesFromMemory(this.ctx, memory, options);
    }
}
