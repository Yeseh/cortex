/**
 * Pure helper functions for category path manipulation.
 *
 * These functions operate on category path strings without any storage
 * interaction. They are used internally by category operations and
 * exported for consumers who need path manipulation.
 *
 * @module core/category/operations/helpers
 */

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
