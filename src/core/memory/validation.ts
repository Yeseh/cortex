/**
 * Validation helpers for memory identity and categories
 */

import type { MemoryCategoryPath, MemoryIdentity, MemorySlug, Result } from '../types.ts';
import { buildMemoryIdentity, isValidMemorySlug, normalizeSlugSegments } from '../slug.ts';

export interface MemoryPathValidationError {
    code: 'INVALID_SLUG' | 'INVALID_CATEGORY_DEPTH' | 'INVALID_SLUG_PATH';
    message: string;
    segment?: string;
}

type CategoryPathResult = Result<MemoryCategoryPath, MemoryPathValidationError>;
type IdentityResult = Result<MemoryIdentity, MemoryPathValidationError>;

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

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

export const validateMemorySlugPath = (slugPath: string): IdentityResult => {
    const segments = normalizeSlugSegments(slugPath.split('/'));

    if (segments.length < 2) {
        return err({
            code: 'INVALID_SLUG_PATH',
            message: 'Memory slug path must include at least two segments.',
        });
    }

    const slug = segments[ segments.length - 1 ];
    if (!slug) {
        return err({
            code: 'INVALID_SLUG_PATH',
            message: 'Memory slug path must include at least two segments.',
        });
    }
    const categories = segments.slice(
        0, -1,
    );
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

    return ok(buildMemoryIdentity(
        categoryResult.value, slug as MemorySlug,
    ));
};
