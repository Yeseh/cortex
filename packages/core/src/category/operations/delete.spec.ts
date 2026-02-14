/**
 * Unit tests for the deleteCategory operation.
 *
 * @module core/category/operations/delete.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { createMockStorage, ok } from './test-helpers.spec.ts';
import { deleteCategory } from './delete.ts';
import type { CategoryPath } from '../category-path.ts';

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
