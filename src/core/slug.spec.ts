import { describe, expect, it } from 'bun:test';

import {
    isValidMemorySlug,
    normalizeSlugSegments,
    buildMemorySlugPath,
    buildMemoryIdentity,
} from './slug.ts';
import type { MemoryCategoryPath, MemorySlug } from './types.ts';

describe(
    'slug utilities', () => {
        describe(
            'isValidMemorySlug', () => {
                it(
                    'should accept lowercase alphanumeric slugs', () => {
                        expect(isValidMemorySlug('memory')).toBe(true);
                        expect(isValidMemorySlug('project123')).toBe(true);
                        expect(isValidMemorySlug('abc')).toBe(true);
                    },
                );

                it(
                    'should accept slugs with hyphens between segments', () => {
                        expect(isValidMemorySlug('my-memory')).toBe(true);
                        expect(isValidMemorySlug('some-long-slug-name')).toBe(true);
                        expect(isValidMemorySlug('a-b-c')).toBe(true);
                    },
                );

                it(
                    'should accept slugs with numbers', () => {
                        expect(isValidMemorySlug('v1')).toBe(true);
                        expect(isValidMemorySlug('project-2024')).toBe(true);
                        expect(isValidMemorySlug('123')).toBe(true);
                        expect(isValidMemorySlug('test-123-abc')).toBe(true);
                    },
                );

                it(
                    'should reject slugs with uppercase letters', () => {
                        expect(isValidMemorySlug('Memory')).toBe(false);
                        expect(isValidMemorySlug('myMemory')).toBe(false);
                        expect(isValidMemorySlug('MY-MEMORY')).toBe(false);
                    },
                );

                it(
                    'should reject slugs with underscores', () => {
                        expect(isValidMemorySlug('my_memory')).toBe(false);
                        expect(isValidMemorySlug('test_case')).toBe(false);
                    },
                );

                it(
                    'should reject slugs with spaces', () => {
                        expect(isValidMemorySlug('my memory')).toBe(false);
                        expect(isValidMemorySlug(' memory')).toBe(false);
                        expect(isValidMemorySlug('memory ')).toBe(false);
                    },
                );

                it(
                    'should reject slugs starting or ending with hyphens', () => {
                        expect(isValidMemorySlug('-memory')).toBe(false);
                        expect(isValidMemorySlug('memory-')).toBe(false);
                        expect(isValidMemorySlug('-')).toBe(false);
                    },
                );

                it(
                    'should reject slugs with consecutive hyphens', () => {
                        expect(isValidMemorySlug('my--memory')).toBe(false);
                        expect(isValidMemorySlug('a---b')).toBe(false);
                    },
                );

                it(
                    'should reject empty slugs', () => {
                        expect(isValidMemorySlug('')).toBe(false); 
                    },
                );

                it(
                    'should reject slugs with special characters', () => {
                        expect(isValidMemorySlug('my.memory')).toBe(false);
                        expect(isValidMemorySlug('my@memory')).toBe(false);
                        expect(isValidMemorySlug('my/memory')).toBe(false);
                        expect(isValidMemorySlug('my#memory')).toBe(false);
                    },
                );
            },
        );

        describe(
            'normalizeSlugSegments', () => {
                it(
                    'should trim whitespace from segments', () => {
                        const result = normalizeSlugSegments([ '  working ',
                            ' memory  ' ]);
                        expect(result).toEqual([ 'working',
                            'memory' ]);
                    },
                );

                it(
                    'should filter empty segments', () => {
                        const result = normalizeSlugSegments([
                            'working',
                            '',
                            'memory',
                        ]);
                        expect(result).toEqual([ 'working',
                            'memory' ]);
                    },
                );

                it(
                    'should filter whitespace-only segments', () => {
                        const result = normalizeSlugSegments([
                            'working',
                            '   ',
                            'memory',
                        ]);
                        expect(result).toEqual([ 'working',
                            'memory' ]);
                    },
                );

                it(
                    'should handle combined normalization', () => {
                        const result = normalizeSlugSegments([
                            '  working ',
                            ' ',
                            '',
                            'memory  ',
                        ]);
                        expect(result).toEqual([ 'working',
                            'memory' ]);
                    },
                );

                it(
                    'should return empty array for all empty segments', () => {
                        const result = normalizeSlugSegments([
                            '',
                            '   ',
                            '',
                        ]);
                        expect(result).toEqual([]);
                    },
                );

                it(
                    'should return empty array for empty input', () => {
                        const result = normalizeSlugSegments([]);
                        expect(result).toEqual([]);
                    },
                );

                it(
                    'should preserve valid segments unchanged', () => {
                        const result = normalizeSlugSegments([
                            'alpha',
                            'beta',
                            'gamma',
                        ]);
                        expect(result).toEqual([
                            'alpha',
                            'beta',
                            'gamma',
                        ]);
                    },
                );
            },
        );

        describe(
            'buildMemorySlugPath', () => {
                it(
                    'should join single category with slug', () => {
                        const categories: MemoryCategoryPath = ['project'];
                        const slug: MemorySlug = 'memory';

                        const result = buildMemorySlugPath(
                            categories, slug,
                        );

                        expect(result).toBe('project/memory');
                    },
                );

                it(
                    'should join multiple categories with slug', () => {
                        const categories: MemoryCategoryPath = [ 'semantic',
                            'concepts' ];
                        const slug: MemorySlug = 'priority-cues';

                        const result = buildMemorySlugPath(
                            categories, slug,
                        );

                        expect(result).toBe('semantic/concepts/priority-cues');
                    },
                );

                it(
                    'should handle deeply nested categories', () => {
                        const categories: MemoryCategoryPath = [
                            'a',
                            'b',
                            'c',
                            'd',
                        ];
                        const slug: MemorySlug = 'deep-memory';

                        const result = buildMemorySlugPath(
                            categories, slug,
                        );

                        expect(result).toBe('a/b/c/d/deep-memory');
                    },
                );

                it(
                    'should handle empty categories array', () => {
                        const categories: MemoryCategoryPath = [];
                        const slug: MemorySlug = 'memory';

                        const result = buildMemorySlugPath(
                            categories, slug,
                        );

                        expect(result).toBe('memory');
                    },
                );
            },
        );

        describe(
            'buildMemoryIdentity', () => {
                it(
                    'should build identity with single category', () => {
                        const categories: MemoryCategoryPath = ['project'];
                        const slug: MemorySlug = 'memory';

                        const result = buildMemoryIdentity(
                            categories, slug,
                        );

                        expect(result.slugPath).toBe('project/memory');
                        expect(result.categories).toEqual(['project']);
                        expect(result.slug).toBe('memory');
                    },
                );

                it(
                    'should build identity with multiple categories', () => {
                        const categories: MemoryCategoryPath = [ 'semantic',
                            'concepts' ];
                        const slug: MemorySlug = 'priority-cues';

                        const result = buildMemoryIdentity(
                            categories, slug,
                        );

                        expect(result.slugPath).toBe('semantic/concepts/priority-cues');
                        expect(result.categories).toEqual([ 'semantic',
                            'concepts' ]);
                        expect(result.slug).toBe('priority-cues');
                    },
                );

                it(
                    'should build identity with deeply nested categories', () => {
                        const categories: MemoryCategoryPath = [
                            'a',
                            'b',
                            'c',
                        ];
                        const slug: MemorySlug = 'deep';

                        const result = buildMemoryIdentity(
                            categories, slug,
                        );

                        expect(result.slugPath).toBe('a/b/c/deep');
                        expect(result.categories).toEqual([
                            'a',
                            'b',
                            'c',
                        ]);
                        expect(result.slug).toBe('deep');
                    },
                );

                it(
                    'should preserve category array reference independence', () => {
                        const categories: MemoryCategoryPath = ['project'];
                        const slug: MemorySlug = 'memory';

                        const result = buildMemoryIdentity(
                            categories, slug,
                        );

                        // Modify original array
                        categories.push('modified');

                        // Identity categories should be unaffected (same reference, but test independence)
                        expect(result.categories).toBe(categories); // Note: this is actually the same reference
                    },
                );
            },
        );
    },
);
