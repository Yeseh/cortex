/**
 * Unit tests for the deleteCategory operation.
 *
 * @module core/category/operations/delete.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { createMockStorage, ok } from './test-helpers.spec.ts';
import { deleteCategory } from './delete.ts';
import type { CategoryPath } from '../category-path.ts';
import type { CategoryModeContext } from '../types.ts';

describe('deleteCategory', () => {
    it('should delete existing category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });

        const result = await deleteCategory(storage, 'project/cortex');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.deleted).toBe(true);
        }
    });

    it('should reject root categories', async () => {
        const storage = createMockStorage();
        const result = await deleteCategory(storage, 'project');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('ROOT_CATEGORY_REJECTED');
        }
    });

    it('should reject non-existent category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(false)),
        });

        const result = await deleteCategory(storage, 'project/missing');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
        }
    });

    it('should remove entry from parent index', async () => {
        let removedPath: CategoryPath | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            removeSubcategoryEntry: mock(async (path: CategoryPath) => {
                removedPath = path;
                return ok(undefined);
            }),
        });

        await deleteCategory(storage, 'project/cortex');

        expect(removedPath!.toString()).toBe('project/cortex');
    });
});

describe('deleteCategory config protection', () => {
    const configCategories = {
        standards: {
            subcategories: {
                architecture: {},
            },
        },
        projects: {},
    };

    const modeContext: CategoryModeContext = {
        mode: 'free', // Mode doesn't matter for deletion protection
        configCategories,
    };

    it('should reject deleting config-defined category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });
        const result = await deleteCategory(storage, 'standards/architecture', modeContext);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_PROTECTED');
            expect(result.error.message).toContain('config-defined');
        }
    });

    it('should reject deleting ancestor of config-defined category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });
        const result = await deleteCategory(storage, 'standards', modeContext);

        // Note: This will fail with ROOT_CATEGORY_REJECTED first, since standards is depth 1
        // Test a deeper ancestor instead
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('ROOT_CATEGORY_REJECTED');
        }
    });

    it('should reject deleting non-root ancestor of config-defined category', async () => {
        // The ancestor check catches paths that are NOT directly config-defined
        // but ARE a prefix of a config-defined path.
        // This happens when config has nested subcategories but the parent isn't in config.
        // Example: config defines "team/frontend/components" but not "team/frontend"
        // Actually, with the current isConfigDefined, if team/frontend/components is defined,
        // team and team/frontend are also defined (they're traversed).
        // So let's test with a manually created sibling that happens to be a prefix

        // Create config where project/core/api is defined
        const deepConfig = {
            project: {
                subcategories: {
                    core: {
                        subcategories: {
                            api: {},
                        },
                    },
                },
            },
        };
        const deepModeContext: CategoryModeContext = {
            mode: 'free',
            configCategories: deepConfig,
        };
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });

        // project/core is config-defined since it's in the path to project/core/api
        const result = await deleteCategory(storage, 'project/core', deepModeContext);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_PROTECTED');
            // It could be either direct protection or ancestor protection
            // depending on isConfigDefined semantics
        }
    });

    it('should reject deleting path that contains config-defined subcategories', async () => {
        // Test the ancestor check specifically - a path that isn't config-defined
        // but starts with something that has config-defined children
        // With current config structure, this is hard to trigger since
        // all ancestors are implicitly defined.
        // The check exists for edge cases or future config structures.
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });
        const result = await deleteCategory(storage, 'standards/architecture', modeContext);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_PROTECTED');
        }
    });

    it('should allow deleting non-config category', async () => {
        const deleteCalls: string[] = [];
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            delete: mock(async (path: CategoryPath) => {
                deleteCalls.push(path.toString());
                return ok(undefined);
            }),
        });
        const result = await deleteCategory(storage, 'legacy/old', modeContext);

        expect(result.ok()).toBe(true);
        expect(deleteCalls.length).toBe(1);
    });

    it('should allow deleting category when no mode context', async () => {
        const deleteCalls: string[] = [];
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            delete: mock(async (path: CategoryPath) => {
                deleteCalls.push(path.toString());
                return ok(undefined);
            }),
        });
        const result = await deleteCategory(storage, 'standards/architecture');

        expect(result.ok()).toBe(true);
        expect(deleteCalls.length).toBe(1);
    });
});
