import type { Category, CategoryPath } from "@/category";
import type { Memory } from "@/memory";
import type { StorageAdapterError } from ".";
import type { Result } from "@/result";

/**
 * Result of a reindex operation.
 *
 * Contains warnings about files that could not be indexed normally,
 * such as files with paths that normalize to empty strings or
 * collisions between normalized paths.
 */
export interface ReindexResult {
    /** Warnings about files that were skipped or renamed during indexing */
    warnings: string[];
}

/**
 * Storage interface for index file operations.
 *
 * Handles index file I/O and reindexing operations. Indexes are used
 * to maintain searchable metadata about memories and categories.
 *
 * @example
 * ```typescript
 * // Read and update an index after memory changes
 * const indexResult = await storage.read('project/cortex');
 * if (indexResult.ok && indexResult.value) {
 *   const updatedIndex: Category = {
 *     ...indexResult.value,
 *     memories: [...indexResult.value.memories],
 *   };
 *   await storage.write('project/cortex', updatedIndex);
 * }
 * ```
 */
export interface IndexAdapter {
    /**
     * Reads the contents of an index file.
     *
     * @param path - Index identifier (category path, or empty string for root)
     * @returns Result with file contents, or null if the index does not exist
     *
     * @example
     * ```typescript
     * const rootIndex = await storage.read('');
     * const categoryIndex = await storage.read('standards/typescript');
     * ```
     *
     * @edgeCases
     * - Passing an empty string reads the root index.
     * - When the index file is missing, the result is `ok(null)` rather than an error.
     */
    load(category: CategoryPath): Promise<Result<Category | null, StorageAdapterError>>;

    /**
     * Writes contents to an index file.
     *
     * Creates the file if it does not exist. Overwrites existing content.
     *
     * @param path - Index identifier (category path, or empty string for root)
     * @param contents - The content to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.write('', { memories: [], subcategories: [] });
     * ```
     *
     * @edgeCases
     * - Writing to the root index uses an empty string as the path.
     * - Serialization failures (e.g., invalid paths or counts) surface as `INDEX_ERROR`.
     */
    write(path: CategoryPath, contents: Category
    ): Promise<Result<void, StorageAdapterError>>;

    /**
     * Rebuilds category indexes from the current filesystem state.
     *
     * This is a potentially expensive operation that scans categories
     * and regenerates their index files. Use sparingly, typically for
     * repair operations or initial setup.
     *
     * During reindexing, file paths are normalized to valid slugs:
     * - Uppercase letters are lowercased
     * - Underscores and spaces become hyphens
     * - Invalid characters are removed
     *
     * Files that normalize to empty paths are skipped with a warning.
     * Collisions (multiple files normalizing to the same path) are
     * resolved by appending numeric suffixes (-2, -3, etc.).
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
     * - Empty or missing directories return `ok({ warnings: [] })`.
     * - Slug collisions are resolved automatically and reported in `warnings`.
     */
    reindex(scope: CategoryPath): Promise<Result<ReindexResult, StorageAdapterError>>;

    /**
     * Updates indexes after a memory write operation.
     *
     * This method handles incremental index updates when a memory file
     * is created or modified, avoiding full reindex operations.
     *
     * @param slugPath - Memory identifier path that was written
     * @param memory - The memory that was written
     * @param options - Optional settings for index behavior
     * @param options.createWhenMissing - Create index entries for new categories (default: true)
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * await storage.updateAfterMemoryWrite(
     *   'standards/typescript/formatting',
     *   '---\ncreated_at: 2024-01-01T00:00:00.000Z\n---\nUse Prettier.'
     * );
     * ```
     *
     * @edgeCases
     * - Invalid slug paths return `INDEX_ERROR` without updating any indexes.
     * - If `createWhenMissing` is false, missing category indexes may prevent updates.
     */
    updateAfterMemoryWrite(
        memory: Memory,
        options?: { createWhenMissing?: boolean }
    ): Promise<Result<void, StorageAdapterError>>;
}
