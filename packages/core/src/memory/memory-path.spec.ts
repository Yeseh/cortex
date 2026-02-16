import { describe, expect, it } from 'bun:test';

import { MemoryPath } from '@/memory/memory-path.ts';

describe('MemoryPath', () => {
    describe('fromPath', () => {
        it('should parse category and slug segments', () => {
            const result = MemoryPath.fromString('project/alpha');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.category.toString()).toBe('project');
                expect(result.value.slug.toString()).toBe('alpha');
            }
        });

        it('should ignore empty path segments', () => {
            const result = MemoryPath.fromString('/project//alpha/');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.category.toString()).toBe('project');
                expect(result.value.slug.toString()).toBe('alpha');
            }
        });

        it('should reject paths with fewer than two segments', () => {
            const result = MemoryPath.fromString('project');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
                expect(result.error.message).toBe(
                    'Memory slug path must include at least two segments.',
                );
            }
        });
    });

    describe('fromSegments', () => {
        it('should reject when fewer than two segments are provided', () => {
            const result = MemoryPath.fromSegments('only');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should reject invalid category path segments', () => {
            const result = MemoryPath.fromSegments('   ', 'slug');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
                expect(result.error.message).toBe('Invalid category path.');
            }
        });

        it('should reject invalid slug segment', () => {
            const result = MemoryPath.fromSegments('project', '   ');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_SLUG');
                expect(result.error.message).toBe('Invalid slug.');
            }
        });
    });
});
