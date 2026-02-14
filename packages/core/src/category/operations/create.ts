/**
 * Create category operation.
 *
 * @module core/category/operations/create
 */

import { ok, err, type Result } from '../../result.ts';
import { CategoryPath } from '../category-path.ts';
import type { CategoryStorage, CategoryError, CreateCategoryResult } from '../types.ts';

/**
 * Creates a category and its parent hierarchy, excluding root categories.
 *
 * This function implements idempotent category creation:
 * - If the category exists, returns success with `created: false`
 * - If the category doesn't exist, creates it and any missing ancestors
 * - Root categories are assumed to exist (not created automatically)
 *
 * The creation process:
 * 1. Validate the path is non-empty
 * 2. Check if category already exists (return early if so)
 * 3. Create any missing intermediate ancestors (via {@link getAncestorPaths})
 * 4. Create the target category with an empty index
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to create (e.g., "project/cortex/api")
 * @returns Result with creation details or error
 *
 * @example
 * ```typescript
 * // Create a new category
 * const result = await createCategory(storage, 'project/cortex/api');
 * if (result.ok()) {
 *   console.log(result.value.created ? 'Created' : 'Already existed');
 * }
 *
 * // Handles deep paths - creates 'project/cortex' if missing
 * await createCategory(storage, 'project/cortex/api/handlers');
 * ```
 */
export const createCategory = async (
    storage: CategoryStorage,
    path: string,
): Promise<Result<CreateCategoryResult, CategoryError>> => {
    // Validate path
    const pathResult = CategoryPath.fromString(path);
    if (!pathResult.ok()) {
        return err({
            code: 'INVALID_PATH',
            message: `Invalid category path: ${path}`,
            path,
        });
    };

    // Check if already exists
    const existsResult = await storage.exists(pathResult.value);
    if (!existsResult.ok()) {
        return existsResult;
    }
    if (existsResult.value) {
        return ok({ path, created: false });
    }

    // Create parent categories (excluding depth-1 root categories)
    let currentPath = pathResult.value;
    while (currentPath.parent && currentPath.parent.depth > 1) {
        const parentPath = currentPath.parent;
        const parentExists = await storage.exists(parentPath);
        if (!parentExists.ok()) {
            return parentExists;
        }
        if (!parentExists.value) {
            const ensureParentResult = await storage.ensure(parentPath);
            if (!ensureParentResult.ok()) {
                return ensureParentResult;
            }
        }
        currentPath = parentPath; // Move up to check next ancestor
    }

    // Create the target category
    const ensureResult = await storage.ensure(pathResult.value);
    if (!ensureResult.ok()) {
        return ensureResult;
    }

    return ok({ path, created: true });
};
