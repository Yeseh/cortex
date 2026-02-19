/**
 * Delete category operation.
 *
 * @module core/category/operations/delete
 */

import { ok, err, type Result } from '../../result.ts';
import { CategoryPath } from '../category-path.ts';
import type { CategoryStorage, CategoryError, DeleteCategoryResult, CategoryModeContext } from '../types.ts';
import { isConfigDefined, flattenCategoryPaths } from '../../config.ts';

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
 * - Config-defined categories are protected (returns CATEGORY_PROTECTED)
 * - Ancestors of config-defined categories are protected
 * - Not idempotent: deleting a non-existent category is an error
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to delete (must not be a root category)
 * @param modeContext - Optional mode context for protection checks
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
    modeContext?: CategoryModeContext,
): Promise<Result<DeleteCategoryResult, CategoryError>> => {
    const pathResult = CategoryPath.fromString(path);
    if (!pathResult.ok()) {
        return err({
            code: 'INVALID_PATH',
            message: `Invalid category path: ${path}`,
            path,
        });
    };

    // Reject root (top-level) categories
    if (pathResult.value.depth === 1) {
        return err({
            code: 'ROOT_CATEGORY_REJECTED',
            message: 'Cannot delete root category',
            path,
        });
    }

    // Reject config-defined categories (protected)
    if (modeContext?.configCategories) {
        // Direct config-defined check
        if (isConfigDefined(path, modeContext.configCategories)) {
            return err({
                code: 'CATEGORY_PROTECTED',
                message: `Cannot delete config-defined category '${path}'. ` +
                    'Remove it from config.yaml first.',
                path,
            });
        }

        // Check if this is an ancestor of any config-defined category
        const allConfigPaths = flattenCategoryPaths(modeContext.configCategories);
        const isAncestor = allConfigPaths.some((configPath) =>
            configPath.startsWith(path + '/'));
        if (isAncestor) {
            return err({
                code: 'CATEGORY_PROTECTED',
                message: `Cannot delete '${path}' because it contains config-defined subcategories. ` +
                    'Remove subcategories from config.yaml first.',
                path,
            });
        }
    }

    // Check category exists
    const existsResult = await storage.exists(pathResult.value);
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
    const deleteResult = await storage.delete(pathResult.value);
    if (!deleteResult.ok()) {
        return deleteResult;
    }

    // Remove from parent's subcategories list
    const removeResult = await storage.removeSubcategoryEntry(pathResult.value);
    if (!removeResult.ok()) {
        return removeResult;
    }

    return ok({ path, deleted: true });
};
