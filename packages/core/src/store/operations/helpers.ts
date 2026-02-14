/**
 * Store operation helpers.
 *
 * Pure helper functions for store initialization and management. These utilities
 * handle common patterns like building empty index structures that are used
 * across store operations.
 *
 * @module core/store/operations/helpers
 */

import { CategoryPath } from '@/category/index.ts';
import type { CategoryIndex } from '@/index/types.ts';

/**
 * Creates an empty category index with optional subcategories.
 *
 * Builds a CategoryIndex structure suitable for initializing new stores or
 * categories. The subcategories parameter seeds the index with references to
 * child categories (with zero memory counts), enabling hierarchical navigation.
 *
 * @param subcategories - Subcategory names to include. Each name must be a valid
 *   category path segment (lowercase letters, numbers, hyphens). Defaults to an
 *   empty array, creating an index with no subcategories.
 * @returns CategoryIndex containing an empty `memories` array and `subcategories`
 *   array populated with entries for each provided subcategory name (each with
 *   memoryCount of 0).
 * @throws {Error} If any subcategory name fails CategoryPath validation. This is
 *   an internal helper - callers must validate category names before calling.
 *
 * @example Basic usage - empty index with no subcategories
 * ```typescript
 * const emptyIndex = buildEmptyIndex();
 * // Result: { memories: [], subcategories: [] }
 * ```
 *
 * @example Seeding with top-level categories
 * ```typescript
 * const rootIndex = buildEmptyIndex(['project', 'human', 'standards']);
 * // Result: {
 * //   memories: [],
 * //   subcategories: [
 * //     { path: CategoryPath('project'), memoryCount: 0 },
 * //     { path: CategoryPath('human'), memoryCount: 0 },
 * //     { path: CategoryPath('standards'), memoryCount: 0 }
 * //   ]
 * // }
 * ```
 *
 * @example Edge case - invalid subcategory name throws
 * ```typescript
 * // This will throw because 'Invalid_Name' contains uppercase and underscore
 * buildEmptyIndex(['valid', 'Invalid_Name']); // throws Error
 * ```
 */
export const buildEmptyIndex = (subcategories: string[] = []): CategoryIndex => ({
    memories: [],
    subcategories: subcategories.map((name) => {
        const pathResult = CategoryPath.fromString(name);
        if (!pathResult.ok()) {
            throw new Error(`Invalid subcategory name '${name}': ${pathResult.error.message}`);
        }
        return {
            path: pathResult.value,
            memoryCount: 0,
        };
    }),
});
