/**
 * Slug utilities for memory identity
 */

import type {
  MemoryCategoryPath,
  MemoryIdentity,
  MemorySlug,
  MemorySlugPath,
} from "./types.ts";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isValidMemorySlug = (slug: string): slug is MemorySlug =>
  slugPattern.test(slug);

export const normalizeSlugSegments = (segments: string[]): string[] =>
  segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

export const buildMemorySlugPath = (
  categories: MemoryCategoryPath,
  slug: MemorySlug
): MemorySlugPath => [...categories, slug].join("/") as MemorySlugPath;

export const buildMemoryIdentity = (
  categories: MemoryCategoryPath,
  slug: MemorySlug
): MemoryIdentity => ({
  slugPath: buildMemorySlugPath(categories, slug),
  categories,
  slug,
});
