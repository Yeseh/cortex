import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    categoryExists,
    ensureCategoryDirectory,
    deleteCategoryDirectory,
    updateSubcategoryDescription,
    removeSubcategoryEntry,
    readCategoryIndexForPort,
    writeCategoryIndexForPort,
} from './categories.ts';
import type { FilesystemContext } from './types.ts';

describe('categories module', () => {
    let tempDir: string;
    let ctx: FilesystemContext;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-categories-'));
        ctx = {
            storeRoot: tempDir,
            memoryExtension: '.md',
            indexExtension: '.yaml',
        };
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('categoryExists', () => {
        it('should return true for existing directory', async () => {
            await fs.mkdir(join(tempDir, 'exists'), { recursive: true });

            const result = await categoryExists(ctx, 'exists');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false for non-existing directory', async () => {
            const result = await categoryExists(ctx, 'does-not-exist');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(false);
            }
        });

        it('should handle nested paths', async () => {
            await fs.mkdir(join(tempDir, 'a', 'b', 'c'), { recursive: true });

            const result = await categoryExists(ctx, 'a/b/c');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false for partial paths', async () => {
            await fs.mkdir(join(tempDir, 'a', 'b'), { recursive: true });

            const result = await categoryExists(ctx, 'a/b/c');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(false);
            }
        });
    });

    describe('ensureCategoryDirectory', () => {
        it('should create a new directory', async () => {
            const result = await ensureCategoryDirectory(ctx, 'new-dir');

            expect(result.ok).toBe(true);

            const stats = await fs.stat(join(tempDir, 'new-dir'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create nested directories', async () => {
            const result = await ensureCategoryDirectory(ctx, 'a/b/c/d');

            expect(result.ok).toBe(true);

            const stats = await fs.stat(join(tempDir, 'a', 'b', 'c', 'd'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should succeed if directory already exists', async () => {
            await fs.mkdir(join(tempDir, 'already-exists'), { recursive: true });

            const result = await ensureCategoryDirectory(ctx, 'already-exists');

            expect(result.ok).toBe(true);
        });
    });

    describe('deleteCategoryDirectory', () => {
        it('should delete existing directory', async () => {
            await fs.mkdir(join(tempDir, 'to-delete'), { recursive: true });

            const result = await deleteCategoryDirectory(ctx, 'to-delete');

            expect(result.ok).toBe(true);
            await expect(fs.access(join(tempDir, 'to-delete'))).rejects.toThrow();
        });

        it('should delete directory with contents', async () => {
            await fs.mkdir(join(tempDir, 'with-contents', 'sub'), { recursive: true });
            await fs.writeFile(join(tempDir, 'with-contents', 'file.txt'), 'test');
            await fs.writeFile(join(tempDir, 'with-contents', 'sub', 'nested.txt'), 'nested');

            const result = await deleteCategoryDirectory(ctx, 'with-contents');

            expect(result.ok).toBe(true);
            await expect(fs.access(join(tempDir, 'with-contents'))).rejects.toThrow();
        });

        it('should succeed for non-existing directory', async () => {
            const result = await deleteCategoryDirectory(ctx, 'does-not-exist');

            expect(result.ok).toBe(true);
        });
    });

    describe('updateSubcategoryDescription', () => {
        it('should add description to new subcategory entry', async () => {
            await fs.mkdir(join(tempDir, 'parent'), { recursive: true });

            const result = await updateSubcategoryDescription(
                ctx,
                'parent',
                'parent/child',
                'Test description',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent', 'index.yaml'), 'utf8');
            expect(content).toContain('parent/child');
            expect(content).toContain('Test description');
        });

        it('should update description of existing subcategory', async () => {
            await fs.mkdir(join(tempDir, 'parent2'), { recursive: true });
            const initialIndex = [
                'memories: []',
                'subcategories:',
                '  - path: parent2/child',
                '    memory_count: 5',
                '    description: Old',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent2', 'index.yaml'), initialIndex);

            const result = await updateSubcategoryDescription(
                ctx,
                'parent2',
                'parent2/child',
                'New description',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent2', 'index.yaml'), 'utf8');
            expect(content).toContain('New description');
            expect(content).not.toContain('Old');
        });

        it('should clear description when null', async () => {
            await fs.mkdir(join(tempDir, 'parent3'), { recursive: true });
            const initialIndex = [
                'memories: []',
                'subcategories:',
                '  - path: parent3/child',
                '    memory_count: 0',
                '    description: To be removed',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent3', 'index.yaml'), initialIndex);

            const result = await updateSubcategoryDescription(
                ctx,
                'parent3',
                'parent3/child',
                null,
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent3', 'index.yaml'), 'utf8');
            expect(content).not.toContain('To be removed');
        });

        it('should handle root parent (empty string)', async () => {
            const result = await updateSubcategoryDescription(
                ctx,
                '',
                'top-level',
                'Root level category',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'index.yaml'), 'utf8');
            expect(content).toContain('top-level');
            expect(content).toContain('Root level category');
        });

        it('should sort subcategories alphabetically', async () => {
            await fs.mkdir(join(tempDir, 'parent4'), { recursive: true });

            await updateSubcategoryDescription(ctx, 'parent4', 'parent4/zebra', 'Z');
            await updateSubcategoryDescription(ctx, 'parent4', 'parent4/alpha', 'A');
            await updateSubcategoryDescription(ctx, 'parent4', 'parent4/beta', 'B');

            const content = await fs.readFile(join(tempDir, 'parent4', 'index.yaml'), 'utf8');
            const alphaPos = content.indexOf('alpha');
            const betaPos = content.indexOf('beta');
            const zebraPos = content.indexOf('zebra');

            expect(alphaPos).toBeLessThan(betaPos);
            expect(betaPos).toBeLessThan(zebraPos);
        });
    });

    describe('removeSubcategoryEntry', () => {
        it('should remove subcategory from index', async () => {
            await fs.mkdir(join(tempDir, 'parent5'), { recursive: true });
            const initialIndex = [
                'memories: []',
                'subcategories:',
                '  - path: parent5/keep',
                '    memory_count: 0',
                '  - path: parent5/remove',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent5', 'index.yaml'), initialIndex);

            const result = await removeSubcategoryEntry(ctx, 'parent5', 'parent5/remove');

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent5', 'index.yaml'), 'utf8');
            expect(content).toContain('parent5/keep');
            expect(content).not.toContain('parent5/remove');
        });

        it('should succeed if parent index does not exist', async () => {
            const result = await removeSubcategoryEntry(ctx, 'nonexistent', 'nonexistent/child');

            expect(result.ok).toBe(true);
        });

        it('should succeed if subcategory not in index', async () => {
            await fs.mkdir(join(tempDir, 'parent6'), { recursive: true });
            const initialIndex = [
                'memories: []',
                'subcategories:',
                '  - path: parent6/other',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent6', 'index.yaml'), initialIndex);

            const result = await removeSubcategoryEntry(ctx, 'parent6', 'parent6/missing');

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent6', 'index.yaml'), 'utf8');
            expect(content).toContain('parent6/other');
        });

        it('should handle root parent (empty string)', async () => {
            const initialIndex = [
                'memories: []',
                'subcategories:',
                '  - path: root-child',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'index.yaml'), initialIndex);

            const result = await removeSubcategoryEntry(ctx, '', 'root-child');

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'index.yaml'), 'utf8');
            expect(content).not.toContain('root-child');
        });
    });

    describe('readCategoryIndexForPort', () => {
        it('should return null for missing index', async () => {
            await fs.mkdir(join(tempDir, 'no-index'), { recursive: true });

            const result = await readCategoryIndexForPort(ctx, 'no-index');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBeNull();
            }
        });

        it('should parse valid index file', async () => {
            await fs.mkdir(join(tempDir, 'valid'), { recursive: true });
            const indexContent = [
                'memories:',
                '  - path: valid/mem1',
                '    token_estimate: 100',
                'subcategories:',
                '  - path: valid/sub1',
                '    memory_count: 2',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'valid', 'index.yaml'), indexContent);

            const result = await readCategoryIndexForPort(ctx, 'valid');

            expect(result.ok).toBe(true);
            if (result.ok && result.value) {
                expect(result.value.memories).toHaveLength(1);
                expect(result.value.subcategories).toHaveLength(1);
            }
        });

        it('should return error for malformed index', async () => {
            await fs.mkdir(join(tempDir, 'malformed'), { recursive: true });
            await fs.writeFile(join(tempDir, 'malformed', 'index.yaml'), 'invalid:: yaml::');

            const result = await readCategoryIndexForPort(ctx, 'malformed');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });
    });

    describe('writeCategoryIndexForPort', () => {
        it('should write valid index', async () => {
            await fs.mkdir(join(tempDir, 'write-test'), { recursive: true });

            const result = await writeCategoryIndexForPort(ctx, 'write-test', {
                memories: [{ path: 'write-test/m1', tokenEstimate: 50 }],
                subcategories: [{ path: 'write-test/s1', memoryCount: 1 }],
            });

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'write-test', 'index.yaml'), 'utf8');
            expect(content).toContain('write-test/m1');
            expect(content).toContain('write-test/s1');
        });

        it('should create parent directories', async () => {
            const result = await writeCategoryIndexForPort(ctx, 'deep/nested/cat', {
                memories: [],
                subcategories: [],
            });

            expect(result.ok).toBe(true);

            await fs.access(join(tempDir, 'deep', 'nested', 'cat', 'index.yaml'));
        });
    });
});
