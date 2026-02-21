/**
 * Unit tests for the createCategory operation.
 *
 * @module core/category/operations/create.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { createMockStorage, ok } from './test-helpers.spec.ts';
import type { CategoryPath } from '../category-path.ts';
import type { CategoryModeContext } from '../types.ts';
import { createCategory } from './create.ts';

describe('createCategory', () => {
    it('should create a new category', async () => {
        const storage = createMockStorage();
        const result = await createCategory(storage, 'project/cortex');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.path).toBe('project/cortex');
            expect(result.value.created).toBe(true);
        }
    });

    it('should return created: false for existing category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });
        const result = await createCategory(storage, 'project/cortex');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.created).toBe(false);
        }
    });

    it('should treat empty path as root and skip creation', async () => {
        const storage = createMockStorage();
        const result = await createCategory(storage, '');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.path).toBe('');
            expect(result.value.created).toBe(false);
        }
    });

    it('should create only the requested category path', async () => {
        const ensureCalls: string[] = [];
        const storage = createMockStorage({
            ensure: mock(async (path: CategoryPath) => {
                ensureCalls.push(path.toString());
                return ok(undefined);
            }),
        });

        await createCategory(storage, 'project/cortex/arch');

        expect(ensureCalls).toEqual(['project/cortex/arch']);
    });
});

describe('createCategory mode enforcement', () => {
    // Helper config for tests
    const configCategories = {
        standards: {
            subcategories: {
                architecture: {},
            },
        },
        projects: {},
    };

    describe('subcategories mode', () => {
        const modeContext: CategoryModeContext = {
            mode: 'subcategories',
            configCategories,
        };

        it('should reject new root category not in config', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'legacy/notes', modeContext);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('ROOT_CATEGORY_NOT_ALLOWED');
                expect(result.error.message).toContain('legacy');
                expect(result.error.message).toContain('standards');
            }
        });

        it('should allow subcategory under config-defined root', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'standards/new-sub', modeContext);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.created).toBe(true);
            }
        });

        it('should allow deeply nested subcategory under config-defined root', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'projects/cortex/docs/api', modeContext);

            expect(result.ok()).toBe(true);
        });
    });

    describe('strict mode', () => {
        const modeContext: CategoryModeContext = {
            mode: 'strict',
            configCategories,
        };

        it('should reject category not in config', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'standards/new-category', modeContext);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CATEGORY_PROTECTED');
                expect(result.error.message).toContain('strict mode');
            }
        });

        it('should allow config-defined category', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'standards/architecture', modeContext);

            expect(result.ok()).toBe(true);
        });

        it('should reject creating non-config root category', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'legacy/notes', modeContext);

            // In strict mode, root check happens before INVALID_PATH for root-only
            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CATEGORY_PROTECTED');
            }
        });
    });

    describe('free mode', () => {
        const modeContext: CategoryModeContext = {
            mode: 'free',
            configCategories,
        };

        it('should allow any category', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'legacy/old-stuff', modeContext);

            expect(result.ok()).toBe(true);
        });
    });

    describe('no mode context', () => {
        it('should allow any category when no context provided', async () => {
            const storage = createMockStorage();
            const result = await createCategory(storage, 'anything/goes');

            expect(result.ok()).toBe(true);
        });
    });
});
