/**
 * Pure category business logic operations.
 *
 * This module contains the core business logic for category operations,
 * separated from storage concerns via the CategoryStoragePort interface.
 * All functions are pure (given the same storage state) and return
 * Result types for explicit error handling.
 *
 * @module core/category/operations
 */

import type { Result } from '../types.ts';
import { ok, err } from '../result.ts';
import type {
    CategoryStoragePort,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
} from './types.ts';
import { MAX_DESCRIPTION_LENGTH } from './types.ts';

/**
 * Checks if a path represents a root category (single segment).
 *
 * Root categories are top-level containers like "human", "persona",
 * "project", or "domain". They receive special treatment:
 * - Cannot be deleted via the category API
 * - Cannot have descriptions set
 *
 * @param path - Category path to check
 * @returns True if the path has exactly one segment (is a root category)
 *
 * @example
 * ```typescript
 * isRootCategory('human')           // true
 * isRootCategory('project/cortex')  // false
 * isRootCategory('')                // false (empty path)
 * ```
 */
export const isRootCategory = (path: string): boolean => {
    const segments = path.split('/').filter((s) => s.length > 0);
    return segments.length === 1;
};

/**
 * Extracts the parent path from a category path.
 *
 * Returns an empty string for root categories since they have no parent
 * (or more precisely, their parent is the implicit store root).
 *
 * @param path - Category path to get parent of
 * @returns Parent path, or empty string for root categories
 *
 * @example
 * ```typescript
 * getParentPath('project/cortex/api')  // 'project/cortex'
 * getParentPath('project/cortex')      // 'project'
 * getParentPath('project')             // '' (root has no parent)
 * getParentPath('')                    // '' (edge case)
 * ```
 */
export const getParentPath = (path: string): string => {
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length <= 1) {
        return '';
    }
    return segments.slice(0, -1).join('/');
};

/**
 * Gets all ancestor paths for a category, excluding the root category.
 *
 * This function returns intermediate ancestors that need to be created
 * when creating a deeply nested category. Root categories are excluded
 * because they are pre-defined and should already exist.
 *
 * The algorithm:
 * 1. Split path into segments, filtering empty strings
 * 2. Start from index 2 (skip root at index 0-1)
 * 3. Build paths by joining segments up to each index
 * 4. Stop before the final path (that's the target, not an ancestor)
 *
 * Edge cases:
 * - Empty path → empty array
 * - Root category (1 segment) → empty array (no ancestors to create)
 * - Direct child of root (2 segments) → empty array (parent is root)
 * - Deeper paths → returns intermediate categories only
 *
 * @param path - Category path to get ancestors for
 * @returns Array of ancestor paths, excluding root, in creation order
 *
 * @example
 * ```typescript
 * getAncestorPaths('a/b/c/d')  // ['a/b', 'a/b/c']
 * getAncestorPaths('a/b/c')    // ['a/b']
 * getAncestorPaths('a/b')      // [] (parent is root 'a')
 * getAncestorPaths('a')        // [] (root category)
 * getAncestorPaths('')         // [] (empty path)
 * ```
 */
export const getAncestorPaths = (path: string): string[] => {
    const segments = path.split('/').filter((s) => s.length > 0);
    const ancestors: string[] = [];
    // Start from index 1 to skip root, stop before the path itself
    for (let i = 2; i < segments.length; i++) {
        ancestors.push(segments.slice(0, i).join('/'));
    }
    return ancestors;
};

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
 * if (result.ok) {
 *   console.log(result.value.created ? 'Created' : 'Already existed');
 * }
 *
 * // Handles deep paths - creates 'project/cortex' if missing
 * await createCategory(storage, 'project/cortex/api/handlers');
 * ```
 */
export const createCategory = async (
    storage: CategoryStoragePort,
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
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
        return existsResult;
    }
    if (existsResult.value) {
        return ok({ path, created: false });
    }

    // Create parent categories (excluding root)
    const ancestors = getAncestorPaths(path);
    for (const ancestor of ancestors) {
        const ancestorExists = await storage.categoryExists(ancestor);
        if (!ancestorExists.ok) {
            return ancestorExists;
        }
        if (!ancestorExists.value) {
            const ensureResult = await storage.ensureCategoryDirectory(ancestor);
            if (!ensureResult.ok) {
                return ensureResult;
            }
            // Initialize empty index
            const writeResult = await storage.writeCategoryIndex(ancestor, {
                memories: [],
                subcategories: [],
            });
            if (!writeResult.ok) {
                return writeResult;
            }
        }
    }

    // Create the target category
    const ensureResult = await storage.ensureCategoryDirectory(path);
    if (!ensureResult.ok) {
        return ensureResult;
    }

    // Initialize empty index
    const writeResult = await storage.writeCategoryIndex(path, {
        memories: [],
        subcategories: [],
    });
    if (!writeResult.ok) {
        return writeResult;
    }

    return ok({ path, created: true });
};

/**
 * Sets or clears a category's description.
 *
 * Descriptions provide human-readable context for what a category contains.
 * They are stored in the parent category's index file and displayed
 * when listing categories.
 *
 * Constraints:
 * - Root categories cannot have descriptions (returns ROOT_CATEGORY_REJECTED)
 * - Descriptions are trimmed; empty strings clear the description
 * - Maximum length is {@link MAX_DESCRIPTION_LENGTH} characters
 * - Category must exist (returns CATEGORY_NOT_FOUND if not)
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path (must not be a root category)
 * @param description - Description text (empty string to clear)
 * @returns Result with the final description value or error
 *
 * @example
 * ```typescript
 * // Set a description
 * const result = await setDescription(storage, 'project/cortex', 'Memory system core');
 * if (result.ok) {
 *   console.log(`Description set: ${result.value.description}`);
 * }
 *
 * // Clear a description
 * await setDescription(storage, 'project/cortex', '');
 * // result.value.description === null
 * ```
 */
export const setDescription = async (
    storage: CategoryStoragePort,
    path: string,
    description: string,
): Promise<Result<SetDescriptionResult, CategoryError>> => {
    // Reject root categories
    if (isRootCategory(path)) {
        return err({
            code: 'ROOT_CATEGORY_REJECTED',
            message: 'Cannot set description on root category',
            path,
        });
    }

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
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
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
        finalDescription,
    );
    if (!updateResult.ok) {
        return updateResult;
    }

    return ok({ path, description: finalDescription });
};

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
 * if (result.ok) {
 *   console.log(`Deleted: ${result.value.path}`);
 * } else if (result.error.code === 'CATEGORY_NOT_FOUND') {
 *   console.log('Category does not exist');
 * }
 * ```
 */
export const deleteCategory = async (
    storage: CategoryStoragePort,
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
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
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
    const deleteResult = await storage.deleteCategoryDirectory(path);
    if (!deleteResult.ok) {
        return deleteResult;
    }

    // Remove from parent's subcategories list
    const parentPath = getParentPath(path);
    const removeResult = await storage.removeSubcategoryEntry(parentPath, path);
    if (!removeResult.ok) {
        return removeResult;
    }

    return ok({ path, deleted: true });
};
