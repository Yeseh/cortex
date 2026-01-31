/**
 * Filesystem implementation of the CategoryStorage interface.
 *
 * This class provides a focused implementation of the CategoryStorage interface
 * for filesystem-based storage, following the Interface Segregation Principle.
 * Categories are represented as directories in the filesystem, with optional
 * index files containing metadata about memories and subcategories.
 *
 * @module core/storage/filesystem/category-storage
 * @see {@link CategoryStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - Related memory storage implementation
 * @see {@link FilesystemIndexStorage} - Related index storage implementation
 */

import type { Result } from '@yeseh/cortex-core';
import type { CategoryError, CategoryStorage } from '@yeseh/cortex-core/category';
import type { CategoryIndex } from '@yeseh/cortex-core/index';
import type { FilesystemContext } from './types.ts';
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
 * Filesystem-based implementation of the CategoryStorage interface.
 *
 * Provides category management operations using the local filesystem.
 * This class delegates to pure functions in the categories module,
 * providing a clean object-oriented interface for dependency injection.
 *
 * Categories are organized hierarchically as directories:
 * - Path: `{storeRoot}/{category/path}/`
 * - Index: `{storeRoot}/{category/path}/_index.yaml`
 *
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/storage',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 * const storage = new FilesystemCategoryStorage(ctx);
 *
 * // Create a new category hierarchy
 * await storage.ensureCategoryDirectory('project/cortex/docs');
 *
 * // Check if category exists
 * const existsResult = await storage.categoryExists('project/cortex');
 * if (existsResult.ok && existsResult.value) {
 *     console.log('Category exists');
 * }
 *
 * // Update subcategory description in parent's index
 * await storage.updateSubcategoryDescription(
 *     'project/cortex',           // parent path
 *     'project/cortex/docs',      // subcategory path
 *     'Project documentation'     // description
 * );
 *
 * // Delete category and all contents
 * await storage.deleteCategoryDirectory('project/cortex/old');
 * ```
 *
 * @see {@link CategoryStorage} - The interface this class implements
 * @see {@link FilesystemMemoryStorage} - For memory file operations
 */
export class FilesystemCategoryStorage implements CategoryStorage {
    /**
     * Creates a new FilesystemCategoryStorage instance.
     *
     * @param ctx - Filesystem context containing storage root and file extensions
     */
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Checks if a category directory exists in the filesystem.
     *
     * A category is considered to exist if its directory is present,
     * regardless of whether it contains an index file or any memories.
     *
     * @param path - Category path to check (e.g., "project/cortex")
     * @returns Result with true if category exists, false otherwise
     *
     * @example
     * ```typescript
     * const result = await storage.categoryExists('project/cortex');
     * if (result.ok) {
     *     console.log(result.value ? 'Exists' : 'Not found');
     * }
     * ```
     */
    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        return categoryExistsOp(this.ctx, path);
    }

    /**
     * Reads and parses the index file for a category.
     *
     * The index file contains metadata about memories in the category
     * (slugs, tags, expiration dates) and references to subcategories.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with the parsed CategoryIndex, or null if no index exists
     *
     * @example
     * ```typescript
     * const result = await storage.readCategoryIndex('project/cortex');
     * if (result.ok && result.value) {
     *     console.log('Memories:', result.value.memories?.length ?? 0);
     *     console.log('Subcategories:', result.value.subcategories?.length ?? 0);
     * }
     * ```
     */
    async readCategoryIndex(path: string): Promise<Result<CategoryIndex | null, CategoryError>> {
        return readCategoryIndexForPort(this.ctx, path);
    }

    /**
     * Writes or overwrites a category index file.
     *
     * Creates parent directories if needed. The index is serialized
     * to YAML format before writing.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @param index - The CategoryIndex data to write
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const index: CategoryIndex = {
     *     memories: [
     *         { slug: 'architecture', tags: ['design'] }
     *     ],
     *     subcategories: [
     *         { path: 'project/cortex/docs' }
     *     ]
     * };
     * await storage.writeCategoryIndex('project/cortex', index);
     * ```
     */
    async writeCategoryIndex(
        path: string,
        index: CategoryIndex,
    ): Promise<Result<void, CategoryError>> {
        return writeCategoryIndexForPort(this.ctx, path, index);
    }

    /**
     * Ensures a category directory exists, creating it if missing.
     *
     * Creates parent directories recursively if needed. This is an
     * idempotent operation - calling it multiple times has no additional effect.
     *
     * @param path - Category path to create (e.g., "project/cortex/docs")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Creates 'project', 'project/cortex', and 'project/cortex/docs' if needed
     * await storage.ensureCategoryDirectory('project/cortex/docs');
     * ```
     */
    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return ensureCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * This is a destructive operation that removes:
     * - All memory files in the category
     * - All subcategories and their contents
     * - The category's index file
     *
     * Returns success if the directory doesn't exist (idempotent).
     *
     * @param path - Category path to delete (e.g., "project/cortex/old")
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Removes category and all its contents
     * await storage.deleteCategoryDirectory('project/cortex/deprecated');
     * ```
     */
    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return deleteCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Updates the description of a subcategory in its parent's index.
     *
     * Creates the parent's index file and subcategory entry if they don't exist.
     * Use this to add human-readable descriptions to category listings.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory being described
     * @param description - New description, or null to clear the description
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Add description to subcategory
     * await storage.updateSubcategoryDescription(
     *     'project/cortex',       // parent
     *     'project/cortex/docs',  // subcategory
     *     'Project documentation and guides'
     * );
     *
     * // Clear description
     * await storage.updateSubcategoryDescription(
     *     'project/cortex',
     *     'project/cortex/docs',
     *     null
     * );
     * ```
     */
    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null,
    ): Promise<Result<void, CategoryError>> {
        return updateSubcategoryDescriptionOp(this.ctx, parentPath, subcategoryPath, description);
    }

    /**
     * Removes a subcategory entry from its parent's index.
     *
     * Only removes the index entry, not the actual category directory.
     * Returns success if the parent index doesn't exist (idempotent).
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory to remove from index
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Remove subcategory from parent's index
     * await storage.removeSubcategoryEntry(
     *     'project/cortex',
     *     'project/cortex/old-docs'
     * );
     * ```
     */
    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string,
    ): Promise<Result<void, CategoryError>> {
        return removeSubcategoryEntryOp(this.ctx, parentPath, subcategoryPath);
    }
}
