/**
 * Store operation helpers.
 *
 * @module core/store/operations/helpers
 */

import type { CategoryIndex } from '@/index/types.ts';
import { CategoryPath } from '@/category/category-path.ts';

/**
 * Creates an empty category index with optional subcategories.
 *
 * @param subcategories - Subcategory names to include
 * @returns CategoryIndex with empty memories and seeded subcategories
 *
 * @example
 * ```typescript
 * const index = buildEmptyIndex(['project', 'human']);
 * ```
 */
export const buildEmptyIndex = (subcategories: string[] = []): CategoryIndex => ({
    memories: [],
    subcategories: subcategories
        .map((name) => {
            const pathResult = CategoryPath.fromString(name);
            if (!pathResult.ok()) {
                return null;
            }
            return {
                path: pathResult.value,
                memoryCount: 0,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
});
