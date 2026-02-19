/**
 * Create category operation.
 *
 * @module core/category/operations/create
 */

import { ok, err, type Result } from '../../result.ts';
import { CategoryPath } from '../category-path.ts';
import type { CategoryStorage, CategoryError, CreateCategoryResult, CategoryModeContext } from '../types.ts';
import { isConfigDefined } from '../../config.ts';

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
    storage: CategoryStorage,
    path: string,
    modeContext?: CategoryModeContext,
): Promise<Result<CreateCategoryResult, CategoryError>> => {
    // Validate path
    const pathResult = CategoryPath.fromString(path);
    if (!pathResult.ok()) {
        return err({
            code: 'INVALID_PATH',
            message: `Invalid category path: ${path}`,
            path,
        });
    }

    // Cannot create root category (it always exists implicitly)
    if (pathResult.value.isRoot) {
        return err({
            code: 'INVALID_PATH',
            message: 'Cannot create root category',
            path,
        });
    }

    // Mode enforcement checks (when context provided)
    if (modeContext) {
        const { mode, configCategories } = modeContext;

        // In subcategories mode, reject new root categories not in config
        if (mode === 'subcategories' && configCategories) {
            const segments = path.split('/');
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
        if (mode === 'strict' && configCategories) {
            if (!isConfigDefined(path, configCategories)) {
                return err({
                    code: 'CATEGORY_PROTECTED',
                    message: `Cannot create category '${path}' in strict mode. ` +
                        'Only config-defined categories are allowed. Update config.yaml to add new categories.',
                    path,
                });
            }
        }
    }

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
