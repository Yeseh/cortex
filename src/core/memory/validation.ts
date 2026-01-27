/**
 * Validation helpers for memory identity and categories.
 *
 * This module provides functions for validating memory paths and
 * category structures to ensure they conform to the expected format.
 *
 * @module core/memory/validation
 */

import type { MemoryCategoryPath, MemoryIdentity, MemorySlug } from '../types.ts';
import { ok, err, type Result } from '../result.ts';
import { buildMemoryIdentity, isValidMemorySlug, normalizeSlugSegments } from '../slug.ts';

export interface MemoryPathValidationError {
    code: 'INVALID_SLUG' | 'INVALID_CATEGORY_DEPTH' | 'INVALID_SLUG_PATH';
    message: string;
    segment?: string;
}

type CategoryPathResult = Result<MemoryCategoryPath, MemoryPathValidationError>;
type IdentityResult = Result<MemoryIdentity, MemoryPathValidationError>;

/**
 * Validates that category segments form a valid path.
 *
 * Category paths must have at least one segment, and each segment
 * must be a valid lowercase slug (letters, numbers, hyphens).
 *
 * @param categories - Array of category segments to validate
 * @returns Result containing the validated path or a validation error
 *
 * @example
 * ```typescript
 * const result = validateCategoryPath(['project', 'cortex']);
 * if (result.ok) {
 *   console.log(result.value); // ['project', 'cortex']
 * }
 * ```
 */
export const validateCategoryPath = (categories: string[]): CategoryPathResult => {
    const normalized = normalizeSlugSegments(categories);

    if (normalized.length < 1) {
        return err({
            code: 'INVALID_CATEGORY_DEPTH',
            message: 'Categories must include at least one segment.',
        });
    }

    for (const segment of normalized) {
        if (!isValidMemorySlug(segment)) {
            return err({
                code: 'INVALID_SLUG',
                message: 'Category segments must be lowercase slugs.',
                segment,
            });
        }
    }

    return ok(normalized as MemoryCategoryPath);
};

/**
 * Validates and parses a memory slug path into its identity components.
 *
 * A memory slug path must contain at least two segments separated by `/`:
 * one or more category segments followed by the memory slug. All segments
 * must be valid lowercase slugs (letters, numbers, hyphens).
 *
 * @param slugPath - The full path string (e.g., "project/cortex/config")
 * @returns Result containing the validated MemoryIdentity or a validation error
 *
 * @example
 * ```typescript
 * const result = validateMemorySlugPath('project/cortex/config');
 * if (result.ok) {
 *   console.log(result.value.categories); // ['project', 'cortex']
 *   console.log(result.value.slug);       // 'config'
 * }
 * ```
 */
export const validateMemorySlugPath = (slugPath: string): IdentityResult => {
    const segments = normalizeSlugSegments(slugPath.split('/'));

    if (segments.length < 2) {
        return err({
            code: 'INVALID_SLUG_PATH',
            message: 'Memory slug path must include at least two segments.',
        });
    }

    const slug = segments[segments.length - 1];
    if (!slug) {
        return err({
            code: 'INVALID_SLUG_PATH',
            message: 'Memory slug path must include at least two segments.',
        });
    }
    const categories = segments.slice(0, -1);
    const categoryResult = validateCategoryPath(categories);

    if (!categoryResult.ok) {
        return categoryResult;
    }

    if (!isValidMemorySlug(slug)) {
        return err({
            code: 'INVALID_SLUG',
            message: 'Slug path segments must be lowercase slugs.',
            segment: slug,
        });
    }

    return ok(buildMemoryIdentity(categoryResult.value, slug as MemorySlug));
};
