import { describe, expect, it } from 'bun:test';

import { normalizeSlugSegments } from '../slug.ts';
import { validateCategoryPath, validateMemorySlugPath } from './validation.ts';

describe('memory slug validation', () => {
    it('should accept category/memory slug paths', () => {
        const result = validateMemorySlugPath('working/preferences');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.slugPath).toBe('working/preferences');
            expect(result.value.categories).toEqual(['working']);
            expect(result.value.slug).toBe('preferences');
        }
    });

    it('should accept category/subcategory/memory slug paths', () => {
        const result = validateMemorySlugPath('semantic/concepts/priority-cues');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.slugPath).toBe('semantic/concepts/priority-cues');
            expect(result.value.categories).toEqual([
                'semantic', 'concepts',
            ]);
            expect(result.value.slug).toBe('priority-cues');
        }
    });

    it('should reject slug paths with invalid depth', () => {
        const tooShallow = validateMemorySlugPath('working');

        expect(tooShallow.ok).toBe(false);
        if (!tooShallow.ok) {
            expect(tooShallow.error.code).toBe('INVALID_SLUG_PATH');
        }
    });

    it('should accept deep slug paths', () => {
        const result = validateMemorySlugPath('a/b/c/d');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.slugPath).toBe('a/b/c/d');
            expect(result.value.categories).toEqual([
                'a',
                'b',
                'c',
            ]);
            expect(result.value.slug).toBe('d');
        }
    });

    it('should normalize whitespace and empty segments', () => {
        const normalized = normalizeSlugSegments([
            '  working ',
            ' ',
            'memory  ',
        ]);
        expect(normalized).toEqual([
            'working', 'memory',
        ]);

        const result = validateMemorySlugPath('working/ /memory');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.slugPath).toBe('working/memory');
            expect(result.value.categories).toEqual(['working']);
            expect(result.value.slug).toBe('memory');
        }
    });
});

describe('memory category validation', () => {
    it('should accept one or two category segments', () => {
        const oneLevel = validateCategoryPath(['working']);
        expect(oneLevel.ok).toBe(true);
        if (oneLevel.ok) {
            expect(oneLevel.value).toEqual(['working']);
        }

        const twoLevel = validateCategoryPath([
            'semantic', 'concepts',
        ]);
        expect(twoLevel.ok).toBe(true);
        if (twoLevel.ok) {
            expect(twoLevel.value).toEqual([
                'semantic', 'concepts',
            ]);
        }
    });

    it('should reject categories outside the allowed depth', () => {
        const empty = validateCategoryPath([]);

        expect(empty.ok).toBe(false);
        if (!empty.ok) {
            expect(empty.error.code).toBe('INVALID_CATEGORY_DEPTH');
        }
    });

    it('should accept deep category paths', () => {
        const deep = validateCategoryPath([
            'one',
            'two',
            'three',
        ]);

        expect(deep.ok).toBe(true);
        if (deep.ok) {
            expect(deep.value).toEqual([
                'one',
                'two',
                'three',
            ]);
        }
    });

    it('should reject non-slug segments', () => {
        const result = validateCategoryPath([
            'Working', 'notes',
        ]);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_SLUG');
            expect(result.error.segment).toBe('Working');
        }
    });
});
