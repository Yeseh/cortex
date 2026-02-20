/**
 * Create category operation.
 *
 * @module core/category/operations/create
 */

import { ok, err } from '../../result.ts';
import { CategoryPath } from '../category-path.ts';
import type { CreateCategoryResult as CreatedCatagory, CategoryModeContext, CategoryResult } from '../types.ts';
import { type CategoryAdapter } from '@/storage/category-adapter.ts';
import { isConfigDefined } from '../../config/config.ts';

/**
 * Creates a category and its parent hierarchy, excluding root categories.
 *
 * This function implements idempotent category creation:
 * - If the category exists, returns success with `created: false`
 * - If the category doesn't exist, creates it and any missing ancestors
 * - Root categories are assumed to exist (not created automatically)
 *
 * When `modeContext` is provided, enforces mode-based restrictions:
 * - `free` mode: No restrictions (default behavior)
 * - `subcategories` mode: Rejects new root categories not defined in config
 * - `strict` mode: Rejects any category not defined in config
 *
 * The creation process:
 * 1. Validate the path is non-empty
 * 2. Apply mode-based restrictions (if modeContext provided)
 * 3. Check if category already exists (return early if so)
 * 4. Create any missing intermediate ancestors (via {@link getAncestorPaths})
 * 5. Create the target category with an empty index
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to create (e.g., "project/cortex/api")
 * @param modeContext - Optional mode context for permission enforcement
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
 *
 * // With mode enforcement
 * const modeContext = { mode: 'subcategories', configCategories: { standards: {} } };
 * const result = await createCategory(storage, 'legacy/notes', modeContext);
 * // Returns error: ROOT_CATEGORY_NOT_ALLOWED
 * ```
 */
export const createCategory = async (
    storage: CategoryAdapter,
    path: string,
    modeContext?: CategoryModeContext,
): Promise<CategoryResult<CreatedCatagory>> => {
    // Validate path
    const pathResult = CategoryPath.fromString(path);
    if (!pathResult.ok()) {
        return err({
            code: 'INVALID_PATH',
            message: `Invalid category path: ${path}`,
            path,
        });
    }

    // Root implicitly exists - return early without creation 
    if (pathResult.value.isRoot) {
        return ok({ path, created: false }); 
    }

    // Check if already exists
    const existsResult = await storage.exists(pathResult.value);
    if (!existsResult.ok()) {
        return existsResult;
    }
    if (existsResult.value) {
        return ok({ path, created: false });
    }

    // Mode enforcement checks (when context provided)
    const categoryPath = pathResult.value;
    if (modeContext) {
        const { mode, configCategories } = modeContext;
        const stringPath = categoryPath.toString();

        const hasConfigCategories = !!configCategories 
            && Object.keys(configCategories).length > 0;

        // In subcategories mode, reject new root categories not in config
        if (mode === 'subcategories' && hasConfigCategories) {
            const segments = stringPath.split('/');
            const rootCategory = segments[0];

            if (rootCategory && !isConfigDefined(rootCategory, configCategories)) {
                const allowedRoots = Object.keys(configCategories);
                return err({
                    code: 'ROOT_CATEGORY_NOT_ALLOWED',
                    message: `Cannot create new root category '${rootCategory}' in subcategories mode. ` +
                        `Allowed root categories: ${allowedRoots.join(', ') || 'none defined'}. ` +
                        'Add the category to config.yaml or use an existing root category.',
                    path,
                });
            }
        }

        // In strict mode, reject any non-config-defined category
        if (mode === 'strict' && hasConfigCategories) {
            if (!isConfigDefined(path, configCategories)) {
                return err({
                    code: 'CATEGORY_PROTECTED',
                    message: `Cannot create category '${path}' in strict mode. ` +
                        'Only config-defined categories are allowed. User must update configuration to allow this category.',
                    path,
                });
            }
        }
    }

    // Create category (and any missing ancestors)
    const ensureExistsResult = await storage.ensure(pathResult.value);
    if (!ensureExistsResult.ok()) {
        return ensureExistsResult;
    }

    return ok({ path, created: true });
};
