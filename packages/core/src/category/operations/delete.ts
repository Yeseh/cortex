/**
 * Delete category operation.
 *
 * @module core/category/operations/delete
 */

import { ok, err, type Result } from '../../result.ts';
import type { CategoryStorage, CategoryError, DeleteCategoryResult } from '../types.ts';
import { isRootCategory } from './helpers.ts';
import { getParentPath } from './helpers.ts';

/**
 * Deletes a category and all its contents recursively.
 *
 * This is a destructive operation that removes:
 * - All memories within the category
 * - All subcategories and their contents
 * - The category's entry in its parent's index
 *
 * Constraints:
 * - Root categories cannot be deleted (returns ROOT_CATEGORY_REJECTED)
 * - Category must exist (returns CATEGORY_NOT_FOUND if not)
 * - Not idempotent: deleting a non-existent category is an error
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to delete (must not be a root category)
 * @returns Result confirming deletion or error
 *
 * @example
 * ```typescript
 * const result = await deleteCategory(storage, 'project/cortex/old-api');
 * if (result.ok()) {
 *   console.log(`Deleted: ${result.value.path}`);
 * } else if (result.error.code === 'CATEGORY_NOT_FOUND') {
 *   console.log('Category does not exist');
 * }
 * ```
 */
export const deleteCategory = async (
    storage: CategoryStorage,
    path: string,
): Promise<Result<DeleteCategoryResult, CategoryError>> => {
    // Reject root categories
    if (isRootCategory(path)) {
        return err({
            code: 'ROOT_CATEGORY_REJECTED',
            message: 'Cannot delete root category',
            path,
        });
    }

    // Check category exists
    const existsResult = await storage.exists(path);
    if (!existsResult.ok()) {
        return existsResult;
    }
    if (!existsResult.value) {
        return err({
            code: 'CATEGORY_NOT_FOUND',
            message: `Category not found: ${path}`,
            path,
        });
    }

    // Delete the category directory recursively
    const deleteResult = await storage.delete(path);
    if (!deleteResult.ok()) {
        return deleteResult;
    }

    // Remove from parent's subcategories list
    const parentPath = getParentPath(path);
    const removeResult = await storage.removeSubcategoryEntry(parentPath, path);
    if (!removeResult.ok()) {
        return removeResult;
    }

    return ok({ path, deleted: true });
};
