/**
 * Unit tests for the createCategory operation.
 *
 * @module core/category/operations/create.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { createMockStorage, ok } from './test-helpers.spec.ts';
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

    it('should reject empty path', async () => {
        const storage = createMockStorage();
        const result = await createCategory(storage, '');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should not create root categories in ancestors', async () => {
        const ensureCalls: string[] = [];
        const storage = createMockStorage({
            ensure: mock(async (path: string) => {
                ensureCalls.push(path);
                return ok(undefined);
            }),
        });

        await createCategory(storage, 'project/cortex/arch');

        // Should create project/cortex but not project (root)
        expect(ensureCalls).toContain('project/cortex');
        expect(ensureCalls).not.toContain('project');
    });
});
