/**
 * Slug utilities for memory identity
 */

import type { MemoryCategoryPath, MemoryIdentity, MemorySlug, MemorySlugPath } from './types.ts';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isValidMemorySlug = (slug: string): slug is MemorySlug => slugPattern.test(slug);

/**
 * Converts a string into a valid memory slug.
 *
 * Transformation rules:
 * - Converts to lowercase
 * - Replaces spaces, underscores, and other whitespace with hyphens
 * - Removes invalid characters (anything not a-z, 0-9, or hyphen)
 * - Collapses multiple consecutive hyphens into one
 * - Trims leading/trailing hyphens
 *
 * @param input - Raw string to convert
 * @returns Valid slug string, or empty string if input normalizes to nothing
 *
 * @example
 * ```typescript
 * toSlug('My Folder')      // 'my-folder'
 * toSlug('some_memory')    // 'some-memory'
 * toSlug('UPPERCASE')      // 'uppercase'
 * toSlug('@#$%')           // ''
 * ```
 */
export const toSlug = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/[\s_]+/g, '-')        // spaces/underscores → hyphens
        .replace(/[^a-z0-9-]/g, '')     // remove invalid chars
        .replace(/-+/g, '-')            // collapse multiple hyphens
        .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
};

export const normalizeSlugSegments = (segments: string[]): string[] =>
    segments.map((segment) => segment.trim()).filter((segment) => segment.length > 0);

export const buildMemorySlugPath = (
    categories: MemoryCategoryPath,
    slug: MemorySlug,
): MemorySlugPath => [
    ...categories,
    slug, 
].join('/') as MemorySlugPath;

export const buildMemoryIdentity = (
    categories: MemoryCategoryPath,
    slug: MemorySlug,
): MemoryIdentity => ({
    slugPath: buildMemorySlugPath(
        categories, slug,
    ),
    categories,
    slug,
});
