/**
 * Unit tests for the setDescription operation.
 *
 * @module core/category/operations/set-description.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import type { CategoryError } from '../types.ts';
import type { CategoryPath } from '../category-path.ts';
import { createMockStorage, ok, err } from './test-helpers.spec.ts';
import { setDescription } from './set-description.ts';

describe('setDescription', () => {
    it('should set description on existing category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });

        const result = await setDescription(storage, 'project/cortex', 'Test description');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.description).toBe('Test description');
        }
    });

    it('should set description on root categories', async () => {
        let capturedPath: string | null = null;
        let capturedDesc: string | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (path: CategoryPath, desc: string | null) => {
                    capturedPath = path.toString();
                    capturedDesc = desc;
                    return ok(undefined);
                },
            ),
        });
        const result = await setDescription(storage, 'project', 'Root category description');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.description).toBe('Root category description');
        }
        expect(capturedPath as string | null).toBe('project');
        expect(capturedDesc as string | null).toBe('Root category description');
    });

    it('should reject descriptions over 500 characters', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
        });
        const longDesc = 'a'.repeat(501);

        const result = await setDescription(storage, 'project/cortex', longDesc);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('DESCRIPTION_TOO_LONG');
        }
    });

    it('should trim whitespace', async () => {
        let capturedDesc: string | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (_path: CategoryPath, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                },
            ),
        });

        await setDescription(storage, 'project/cortex', '  trimmed  ');

        expect(capturedDesc as string | null).toBe('trimmed');
    });

    it('should clear description with empty string', async () => {
        let capturedDesc: string | null = 'initial';
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (_path: CategoryPath, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                },
            ),
        });

        await setDescription(storage, 'project/cortex', '');

        expect(capturedDesc).toBeNull();
    });

    it('should reject non-existent category', async () => {
        const storage = createMockStorage({
            exists: mock(async () => ok(false)),
        });

        const result = await setDescription(storage, 'project/missing', 'Test');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
        }
    });

    it('should clear description with whitespace-only string', async () => {
        let capturedDesc: string | null = 'initial';
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (_path: CategoryPath, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                },
            ),
        });

        await setDescription(storage, 'project/cortex', '   ');

        expect(capturedDesc as string | null).toBeNull();
    });

    it('should accept descriptions exactly at 500 characters', async () => {
        let capturedDesc: string | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (_path: CategoryPath, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                },
            ),
        });
        const exactlyMaxDesc = 'a'.repeat(500);

        const result = await setDescription(storage, 'project/cortex', exactlyMaxDesc);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.description).toBe(exactlyMaxDesc);
        }
        expect(capturedDesc as string | null).toBe(exactlyMaxDesc);
    });

    it('should propagate storage errors from categoryExists', async () => {
        const storageError: CategoryError = {
            code: 'STORAGE_ERROR',
            message: 'Disk full',
        };
        const storage = createMockStorage({
            exists: mock(async () => err(storageError)),
        });

        const result = await setDescription(storage, 'project/cortex', 'Test');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
            expect(result.error.message).toBe('Disk full');
        }
    });
});
