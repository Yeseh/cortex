/**
 * Create category operation.
 *
 * @module core/category/operations/create
 */

import { ok, err, type Result } from '../../result.ts';
import type { CategoryStorage, CategoryError, CreateCategoryResult } from '../types.ts';
import { getAncestorPaths } from './helpers.ts';

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
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) {
        return err({
            code: 'INVALID_PATH',
            message: 'Category path cannot be empty',
            path,
        });
    }

    // Check if already exists
    const existsResult = await storage.exists(path);
    if (!existsResult.ok()) {
        return existsResult;
    }
    if (existsResult.value) {
        return ok({ path, created: false });
    }

    // Create parent categories (excluding root)
    const ancestors = getAncestorPaths(path);
    for (const ancestor of ancestors) {
        const ancestorExists = await storage.exists(ancestor);
        if (!ancestorExists.ok()) {
            return ancestorExists;
        }
        if (!ancestorExists.value) {
            const ensureResult = await storage.ensure(ancestor);
            if (!ensureResult.ok()) {
                return ensureResult;
            }
        }
    }

    // Create the target category
    const ensureResult = await storage.ensure(path);
    if (!ensureResult.ok()) {
        return ensureResult;
    }

    return ok({ path, created: true });
};
