/**
 * FilesystemCategoryStorage - Implementation of CategoryStorage interface.
 *
 * This class provides a focused implementation of the CategoryStorage interface
 * for filesystem-based storage, following the Interface Segregation Principle.
 *
 * @module core/storage/filesystem/category-storage
 */

import type { Result } from '../../types.ts';
import type { CategoryError, CategoryStorage } from '../../category/types.ts';
import type { CategoryIndex } from '../../index/types.ts';
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
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/storage',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 * const storage = new FilesystemCategoryStorage(ctx);
 *
 * // Check if category exists
 * const exists = await storage.categoryExists('project/cortex');
 * ```
 */
export class FilesystemCategoryStorage implements CategoryStorage {
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Checks if a category directory exists.
     *
     * @param path - Category path to check (e.g., "project/cortex")
     * @returns Result with true if category exists, false otherwise
     */
    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        return categoryExistsOp(this.ctx, path);
    }

    /**
     * Reads the index file for a category.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @returns Result with the parsed CategoryIndex or null if not found
     */
    async readCategoryIndex(path: string): Promise<Result<CategoryIndex | null, CategoryError>> {
        return readCategoryIndexForPort(this.ctx, path);
    }

    /**
     * Writes or overwrites a category index file.
     *
     * Creates parent directories if needed.
     *
     * @param path - Category path (e.g., "project/cortex")
     * @param index - The CategoryIndex to write
     * @returns Result indicating success or failure
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
     * Creates parent directories recursively if needed.
     *
     * @param path - Category path to create (e.g., "project/cortex")
     * @returns Result indicating success or failure
     */
    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return ensureCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Deletes a category directory and all its contents recursively.
     *
     * Returns success if the directory doesn't exist.
     *
     * @param path - Category path to delete (e.g., "project/cortex")
     * @returns Result indicating success or failure
     */
    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        return deleteCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Updates the description of a subcategory in its parent's index.
     *
     * Creates the parent index and subcategory entry if they don't exist.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory
     * @param description - New description or null to clear
     * @returns Result indicating success or failure
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
     * Returns success if the parent index doesn't exist.
     *
     * @param parentPath - Path to the parent category (empty string for root)
     * @param subcategoryPath - Full path to the subcategory to remove
     * @returns Result indicating success or failure
     */
    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string,
    ): Promise<Result<void, CategoryError>> {
        return removeSubcategoryEntryOp(this.ctx, parentPath, subcategoryPath);
    }
}
