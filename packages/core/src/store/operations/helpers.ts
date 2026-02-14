/**
 * Store operation helpers.
 *
 * @module core/store/operations/helpers
 */

import type { CategoryIndex } from '@/index/types.ts';

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
    subcategories: subcategories.map((name) => ({
        path: name,
        memoryCount: 0,
    })),
});
