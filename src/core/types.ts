/**
 * Core type definitions for the Cortex memory system
 */

/** Result type for non-throwing operations */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Slug segment used for memory categories and identity */
export type MemorySlug = string;

/** One or more category segments */
export type MemoryCategoryPath = MemorySlug[];

/** Slug path for identifying memories */
export type MemorySlugPath = string;

/** Parsed memory identity from a slug path */
export interface MemoryIdentity {
    slugPath: MemorySlugPath;
    categories: MemoryCategoryPath;
    slug: MemorySlug;
}
