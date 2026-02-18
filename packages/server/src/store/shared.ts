/**
 * Shared utilities for store tools and resources.
 * @module server/store/shared
 */

import type { CategoryDefinition } from '@yeseh/cortex-core';

/**
 * Information about a category in the hierarchy for MCP responses.
 * Includes the full path for easy access.
 */
export type CategoryInfo = {
    /** Full path (e.g., "standards/architecture") */
    path: string;
    /** Optional description */
    description?: string;
    /** Nested subcategories */
    subcategories: CategoryInfo[];
};

/**
 * Converts a CategoryDefinition hierarchy to CategoryInfo array.
 * Recursively converts nested definitions with full path tracking.
 *
 * @module server/store/shared
 * @param definitions - Record of category name to definition
 * @param prefix - Path prefix for nested categories
 * @returns Array of CategoryInfo with full paths
 *
 * @example
 * ```ts
 * const defs = { standards: { description: 'Coding standards', subcategories: { arch: {} } } };
 * const result = convertToCategories(defs);
 * // [{ path: 'standards', description: 'Coding standards', subcategories: [{ path: 'standards/arch', ... }] }]
 * ```
 */
export const convertToCategories = (
    definitions: Record<string, CategoryDefinition> | undefined,
    prefix = '',
): CategoryInfo[] => {
    if (!definitions) {
        return [];
    }

    return Object.entries(definitions)
        .map(([
            name, def,
        ]) => {
            const catPath = prefix ? `${prefix}/${name}` : name;
            return {
                path: catPath,
                ...(def.description !== undefined && { description: def.description }),
                subcategories: convertToCategories(def.subcategories, catPath),
            };
        })
        .sort((a, b) => a.path.localeCompare(b.path));
};
