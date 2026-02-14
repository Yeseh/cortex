/**
 * Set category description operation.
 *
 * @module core/category/operations/set-description
 */

import { ok, err, type Result } from '../../result.ts';
import type { CategoryStorage, CategoryError, SetDescriptionResult } from '../types.ts';
import { MAX_DESCRIPTION_LENGTH } from '../types.ts';
import { getParentPath } from './helpers.ts';

/**
 * Sets or clears a category's description.
 *
 * Descriptions provide human-readable context for what a category contains.
 * They are stored in the parent category's index file and displayed
 * when listing categories. For root categories, descriptions are stored
 * in the store's root index file.
 *
 * Constraints:
 * - Descriptions are trimmed; empty strings clear the description
 * - Maximum length is {@link MAX_DESCRIPTION_LENGTH} characters
 * - Category must exist (returns CATEGORY_NOT_FOUND if not)
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path (can be root or nested)
 * @param description - Description text (empty string to clear)
 * @returns Result with the final description value or error
 *
 * @example
 * ```typescript
 * // Set a description on a subcategory
 * const result = await setDescription(storage, 'project/cortex', 'Memory system core');
 * if (result.ok()) {
 *   console.log(`Description set: ${result.value.description}`);
 * }
 *
 * // Set a description on a root category
 * await setDescription(storage, 'project', 'Project-related memories');
 *
 * // Clear a description
 * await setDescription(storage, 'project/cortex', '');
 * // result.value.description === null
 * ```
 */
export const setDescription = async (
    storage: CategoryStorage,
    path: string,
    description: string
): Promise<Result<SetDescriptionResult, CategoryError>> => {
    // Trim and validate length
    const trimmed = description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        return err({
            code: 'DESCRIPTION_TOO_LONG',
            message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
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

    // Update description in parent index
    const parentPath = getParentPath(path);
    const finalDescription = trimmed.length > 0 ? trimmed : null;

    const updateResult = await storage.updateSubcategoryDescription(
        parentPath,
        path,
        finalDescription
    );
    if (!updateResult.ok()) {
        return updateResult;
    }

    return ok({ path, description: finalDescription });
};
