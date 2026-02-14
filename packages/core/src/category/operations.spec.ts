/**
 * Unit tests for category operations using mock storage port
 */

import { describe, expect, it, mock } from 'bun:test';
import type { CategoryStorage, CategoryError } from './types.ts';
import { ok, err } from '../result.ts';
import {
    isRootCategory,
    getParentPath,
    getAncestorPaths,
    createCategory,
    setDescription,
    deleteCategory,
} from './operations.ts';

// Mock storage port factory
const createMockStorage = (overrides: Partial<CategoryStorage> = {}): CategoryStorage => ({
    exists: mock(async () => ok(false)),
    ensure: mock(async () => ok(undefined)),
    delete: mock(async () => ok(undefined)),
    updateSubcategoryDescription: mock(async () => ok(undefined)),
    removeSubcategoryEntry: mock(async () => ok(undefined)),
    ...overrides,
});

describe('isRootCategory', () => {
    it('should return true for single segment paths', () => {
        expect(isRootCategory('project')).toBe(true);
        expect(isRootCategory('human')).toBe(true);
    });

    it('should return false for multi-segment paths', () => {
        expect(isRootCategory('project/cortex')).toBe(false);
        expect(isRootCategory('project/cortex/arch')).toBe(false);
    });
});

describe('getParentPath', () => {
    it('should return empty string for root categories', () => {
        expect(getParentPath('project')).toBe('');
    });

    it('should return parent path for nested categories', () => {
        expect(getParentPath('project/cortex')).toBe('project');
        expect(getParentPath('project/cortex/arch')).toBe('project/cortex');
    });
});

describe('getAncestorPaths', () => {
    it('should return empty array for root categories', () => {
        expect(getAncestorPaths('project')).toEqual([]);
    });

    it('should return empty array for direct children of root', () => {
        expect(getAncestorPaths('project/cortex')).toEqual([]);
    });

    it('should return ancestor paths for deeply nested', () => {
        expect(getAncestorPaths('project/cortex/arch')).toEqual(['project/cortex']);
        expect(getAncestorPaths('a/b/c/d')).toEqual(['a/b', 'a/b/c']);
    });
});

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
        let capturedParent: string | null = null;
        let capturedDesc: string | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(
                async (parent: string, _path: string, desc: string | null) => {
                    capturedParent = parent;
                    capturedDesc = desc;
                    return ok(undefined);
                }
            ),
        });
        const result = await setDescription(storage, 'project', 'Root category description');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.description).toBe('Root category description');
        }
        // Root category's parent is empty string (store root)
        expect(capturedParent as string | null).toBe('');
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
                async (_parent: string, _path: string, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                }
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
                async (_parent: string, _path: string, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                }
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
                async (_parent: string, _path: string, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                }
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
                async (_parent: string, _path: string, desc: string | null) => {
                    capturedDesc = desc;
                    return ok(undefined);
                }
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
        let removedPath: string | null = null;
        const storage = createMockStorage({
            exists: mock(async () => ok(true)),
            removeSubcategoryEntry: mock(async (_parent: string, path: string) => {
                removedPath = path;
                return ok(undefined);
            }),
        });

        await deleteCategory(storage, 'project/cortex');

        expect(removedPath as string | null).toBe('project/cortex');
    });
});
