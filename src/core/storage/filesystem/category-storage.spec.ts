import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemCategoryStorage } from './category-storage.ts';
import type { FilesystemContext } from './types.ts';
import type { CategoryIndex } from '../../index/types.ts';

describe('FilesystemCategoryStorage', () => {
    let tempDir: string;
    let storage: FilesystemCategoryStorage;
    let ctx: FilesystemContext;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-category-storage-'));
        ctx = {
            storeRoot: tempDir,
            memoryExtension: '.md',
            indexExtension: '.yaml',
        };
        storage = new FilesystemCategoryStorage(ctx);
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('categoryExists', () => {
        it('should return true for existing category', async () => {
            await fs.mkdir(join(tempDir, 'project'), { recursive: true });

            const result = await storage.categoryExists('project');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false for non-existing category', async () => {
            const result = await storage.categoryExists('nonexistent');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(false);
            }
        });

        it('should handle nested category paths', async () => {
            await fs.mkdir(join(tempDir, 'project', 'cortex'), { recursive: true });

            const result = await storage.categoryExists('project/cortex');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBe(true);
            }
        });
    });

    describe('ensureCategoryDirectory', () => {
        it('should create a new category directory', async () => {
            const result = await storage.ensureCategoryDirectory('new-category');

            expect(result.ok).toBe(true);

            const stats = await fs.stat(join(tempDir, 'new-category'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create nested category directories', async () => {
            const result = await storage.ensureCategoryDirectory('project/cortex/docs');

            expect(result.ok).toBe(true);

            const stats = await fs.stat(join(tempDir, 'project', 'cortex', 'docs'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should succeed if directory already exists', async () => {
            await fs.mkdir(join(tempDir, 'existing'), { recursive: true });

            const result = await storage.ensureCategoryDirectory('existing');

            expect(result.ok).toBe(true);
        });
    });

    describe('deleteCategoryDirectory', () => {
        it('should delete an existing category', async () => {
            await fs.mkdir(join(tempDir, 'to-delete'), { recursive: true });
            await fs.writeFile(join(tempDir, 'to-delete', 'test.md'), 'content');

            const result = await storage.deleteCategoryDirectory('to-delete');

            expect(result.ok).toBe(true);
            await expect(fs.access(join(tempDir, 'to-delete'))).rejects.toThrow();
        });

        it('should succeed if directory does not exist', async () => {
            const result = await storage.deleteCategoryDirectory('nonexistent');

            expect(result.ok).toBe(true);
        });

        it('should delete nested directories recursively', async () => {
            await fs.mkdir(join(tempDir, 'parent', 'child'), { recursive: true });
            await fs.writeFile(join(tempDir, 'parent', 'child', 'file.md'), 'content');

            const result = await storage.deleteCategoryDirectory('parent');

            expect(result.ok).toBe(true);
            await expect(fs.access(join(tempDir, 'parent'))).rejects.toThrow();
        });
    });

    describe('readCategoryIndex', () => {
        it('should return null for missing index file', async () => {
            await fs.mkdir(join(tempDir, 'no-index'), { recursive: true });

            const result = await storage.readCategoryIndex('no-index');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toBeNull();
            }
        });

        it('should read and parse existing index file', async () => {
            await fs.mkdir(join(tempDir, 'with-index'), { recursive: true });
            const indexContent = [
                'memories:',
                '  - path: with-index/test-memory',
                '    token_estimate: 100',
                'subcategories:',
                '  - path: with-index/child',
                '    memory_count: 5',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'with-index', 'index.yaml'), indexContent);

            const result = await storage.readCategoryIndex('with-index');

            expect(result.ok).toBe(true);
            if (result.ok && result.value) {
                expect(result.value.memories).toHaveLength(1);
                expect(result.value.memories[0]?.path).toBe('with-index/test-memory');
                expect(result.value.subcategories).toHaveLength(1);
                expect(result.value.subcategories[0]?.path).toBe('with-index/child');
            }
        });

        it('should return error for malformed index file', async () => {
            await fs.mkdir(join(tempDir, 'bad-index'), { recursive: true });
            await fs.writeFile(
                join(tempDir, 'bad-index', 'index.yaml'),
                'not valid yaml content:::',
            );

            const result = await storage.readCategoryIndex('bad-index');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });
    });

    describe('writeCategoryIndex', () => {
        it('should write a new index file', async () => {
            await fs.mkdir(join(tempDir, 'new-index'), { recursive: true });
            const index: CategoryIndex = {
                memories: [{ path: 'new-index/memory1', tokenEstimate: 50 }],
                subcategories: [{ path: 'new-index/sub', memoryCount: 2 }],
            };

            const result = await storage.writeCategoryIndex('new-index', index);

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'new-index', 'index.yaml'), 'utf8');
            expect(content).toContain('new-index/memory1');
            expect(content).toContain('token_estimate: 50');
        });

        it('should overwrite existing index file', async () => {
            await fs.mkdir(join(tempDir, 'existing-index'), { recursive: true });
            await fs.writeFile(join(tempDir, 'existing-index', 'index.yaml'), 'old content');

            const index: CategoryIndex = {
                memories: [{ path: 'existing-index/new', tokenEstimate: 100 }],
                subcategories: [],
            };

            const result = await storage.writeCategoryIndex('existing-index', index);

            expect(result.ok).toBe(true);

            const content = await fs.readFile(
                join(tempDir, 'existing-index', 'index.yaml'),
                'utf8',
            );
            expect(content).toContain('existing-index/new');
            expect(content).not.toContain('old content');
        });

        it('should create parent directories if needed', async () => {
            const index: CategoryIndex = {
                memories: [],
                subcategories: [],
            };

            const result = await storage.writeCategoryIndex('deep/nested/path', index);

            expect(result.ok).toBe(true);

            await fs.access(join(tempDir, 'deep', 'nested', 'path', 'index.yaml'));
        });
    });

    describe('updateSubcategoryDescription', () => {
        it('should add description to existing subcategory', async () => {
            await fs.mkdir(join(tempDir, 'parent'), { recursive: true });
            const indexContent = [
                'memories: []',
                'subcategories:',
                '  - path: parent/child',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent', 'index.yaml'), indexContent);

            const result = await storage.updateSubcategoryDescription(
                'parent',
                'parent/child',
                'A child category',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent', 'index.yaml'), 'utf8');
            expect(content).toContain('A child category');
        });

        it('should create subcategory entry if not exists', async () => {
            await fs.mkdir(join(tempDir, 'parent2'), { recursive: true });
            const indexContent = 'memories: []\nsubcategories: []';
            await fs.writeFile(join(tempDir, 'parent2', 'index.yaml'), indexContent);

            const result = await storage.updateSubcategoryDescription(
                'parent2',
                'parent2/new-child',
                'New child description',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent2', 'index.yaml'), 'utf8');
            expect(content).toContain('parent2/new-child');
            expect(content).toContain('New child description');
        });

        it('should clear description when null is passed', async () => {
            await fs.mkdir(join(tempDir, 'parent3'), { recursive: true });
            const indexContent = [
                'memories: []',
                'subcategories:',
                '  - path: parent3/child',
                '    memory_count: 0',
                '    description: Old description',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent3', 'index.yaml'), indexContent);

            const result = await storage.updateSubcategoryDescription(
                'parent3',
                'parent3/child',
                null,
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent3', 'index.yaml'), 'utf8');
            expect(content).not.toContain('Old description');
        });

        it('should create index file if parent does not have one', async () => {
            await fs.mkdir(join(tempDir, 'no-index-parent'), { recursive: true });

            const result = await storage.updateSubcategoryDescription(
                'no-index-parent',
                'no-index-parent/child',
                'Child category',
            );

            expect(result.ok).toBe(true);

            const content = await fs.readFile(
                join(tempDir, 'no-index-parent', 'index.yaml'),
                'utf8',
            );
            expect(content).toContain('no-index-parent/child');
        });
    });

    describe('removeSubcategoryEntry', () => {
        it('should remove subcategory from parent index', async () => {
            await fs.mkdir(join(tempDir, 'parent4'), { recursive: true });
            const indexContent = [
                'memories: []',
                'subcategories:',
                '  - path: parent4/child1',
                '    memory_count: 0',
                '  - path: parent4/child2',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent4', 'index.yaml'), indexContent);

            const result = await storage.removeSubcategoryEntry('parent4', 'parent4/child1');

            expect(result.ok).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent4', 'index.yaml'), 'utf8');
            expect(content).not.toContain('parent4/child1');
            expect(content).toContain('parent4/child2');
        });

        it('should succeed if parent index does not exist', async () => {
            const result = await storage.removeSubcategoryEntry('nonexistent', 'nonexistent/child');

            expect(result.ok).toBe(true);
        });

        it('should succeed if subcategory is not in index', async () => {
            await fs.mkdir(join(tempDir, 'parent5'), { recursive: true });
            const indexContent = [
                'memories: []',
                'subcategories:',
                '  - path: parent5/existing',
                '    memory_count: 0',
            ].join('\n');
            await fs.writeFile(join(tempDir, 'parent5', 'index.yaml'), indexContent);

            const result = await storage.removeSubcategoryEntry('parent5', 'parent5/nonexistent');

            expect(result.ok).toBe(true);

            // Existing entry should still be there
            const content = await fs.readFile(join(tempDir, 'parent5', 'index.yaml'), 'utf8');
            expect(content).toContain('parent5/existing');
        });
    });
});
