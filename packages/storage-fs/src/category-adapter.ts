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
import type { CategoryError } from '@yeseh/cortex-core/category';
import type { CategoryAdapter } from '@yeseh/cortex-core';
import type { FilesystemContext } from './types.ts';
import {
    exists as existsOp,
    ensure as ensureOp,
    deleteCategoryDirectory as deleteCategoryDirectoryOp,
    updateSubcategoryDescription as setDescriptionOp,
} from './categories.ts';
import type { CategoryPath } from '@yeseh/cortex-core';

/**
 * Filesystem-based implementation of the CategoryStorage interface.
 *
 * Provides category management operations using the local filesystem.
 * This class delegates to pure functions in the categories module,
 * providing a clean object-oriented interface for dependency injection.
 *
 * Categories are organized hierarchically as directories:
 * - Path: `{storeRoot}/{category/path}/`
 * - Index: `{storeRoot}/{category/path}/index.yaml`
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
 * await storage.ensure('project/cortex/docs');
 *
 * // Check if category exists
 * const existsResult = await storage.exists('project/cortex');
 * if (existsResult.ok() && existsResult.value) {
 *     console.log('Category exists');
 * }
 *
 * // Set category description
 * await storage.setDescription(
 *     'project/cortex/docs',      // category path
 *     'Project documentation'     // description
 * );
 *
 * // Delete category and all contents
 * await storage.delete('project/cortex/old');
 * ```
 *
 * @see {@link CategoryStorage} - The interface this class implements
 * @see {@link FilesystemMemoryAdapter} - For memory file operations
 */
export class FilesystemCategoryAdapter implements CategoryAdapter {
    /**
     * Creates a new FilesystemCategoryAdapter instance.
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
     * const result = await storage.exists('project/cortex');
     * if (result.ok()) {
     *     console.log(result.value ? 'Exists' : 'Not found');
     * }
     * ```
     *
     * @edgeCases
     * - Returns `ok(false)` when the directory is missing.
     * - Returns `STORAGE_ERROR` on underlying filesystem access issues.
     */
    async exists(path: CategoryPath): Promise<Result<boolean, CategoryError>> {
        return existsOp(this.ctx, path.toString());
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
     * await storage.ensure('project/cortex/docs');
     * ```
     *
     * @edgeCases
     * - Calling with an existing path is a no-op and should succeed.
     * - Returns `STORAGE_ERROR` on permission or filesystem failures.
     */
    async ensure(path: CategoryPath): Promise<Result<void, CategoryError>> {
        return ensureOp(this.ctx, path.toString());
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
     * await storage.delete('project/cortex/deprecated');
     * ```
     *
     * @edgeCases
     * - Missing directories are treated as successful no-ops.
     * - Returns `STORAGE_ERROR` when deletion fails (e.g., permissions).
     */
    async delete(path: CategoryPath): Promise<Result<void, CategoryError>> {
        return deleteCategoryDirectoryOp(this.ctx, path);
    }

    /**
     * Sets or clears the description of a category in its parent's index.
     *
     * Creates the parent's index file and subcategory entry if they don't exist.
     * Use this to add human-readable descriptions to category listings.
     *
     * @param categoryPath - Full path to the category being described
     * @param description - New description, or null to clear the description
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * // Set description for a category
     * await storage.setDescription(
     *     'project/cortex/docs',
     *     'Project documentation and guides'
     * );
     *
     * // Clear description
     * await storage.setDescription(
     *     'project/cortex/docs',
     *     null
     * );
     * ```
     *
     * @edgeCases
     * - Passing `null` clears the description field.
     * - Creates parent index if it doesn't exist.
     */
    async setDescription(
        categoryPath: CategoryPath,
        description: string | null,
    ): Promise<Result<void, CategoryError>> {
        return setDescriptionOp(this.ctx, categoryPath, description);
    }
}

