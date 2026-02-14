import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemCategoryStorage } from './category-storage.ts';
import type { FilesystemContext } from './types.ts';
import { CategoryPath } from '@yeseh/cortex-core';

const categoryPath = (path: string): CategoryPath => CategoryPath.fromString(path).unwrap();

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

            const result = await storage.exists(categoryPath('project'));

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false for non-existing category', async () => {
            const result = await storage.exists(categoryPath('nonexistent'));

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(false);
            }
        });

        it('should handle nested category paths', async () => {
            await fs.mkdir(join(tempDir, 'project', 'cortex'), { recursive: true });

            const result = await storage.exists(categoryPath('project/cortex'));

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(true);
            }
        });
    });

    describe('ensureCategoryDirectory', () => {
        it('should create a new category directory', async () => {
            const result = await storage.ensure(categoryPath('new-category'));

            expect(result.ok()).toBe(true);

            const stats = await fs.stat(join(tempDir, 'new-category'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create nested category directories', async () => {
            const result = await storage.ensure(categoryPath('project/cortex/docs'));

            expect(result.ok()).toBe(true);

            const stats = await fs.stat(join(tempDir, 'project', 'cortex', 'docs'));
            expect(stats.isDirectory()).toBe(true);
        });

        it('should succeed if directory already exists', async () => {
            await fs.mkdir(join(tempDir, 'existing'), { recursive: true });

            const result = await storage.ensure(categoryPath('existing'));

            expect(result.ok()).toBe(true);
        });
    });

    describe('deleteCategoryDirectory', () => {
        it('should delete an existing category', async () => {
            await fs.mkdir(join(tempDir, 'to-delete'), { recursive: true });
            await fs.writeFile(join(tempDir, 'to-delete', 'test.md'), 'content');

            const result = await storage.delete(categoryPath('to-delete'));

            expect(result.ok()).toBe(true);
            await expect(fs.access(join(tempDir, 'to-delete'))).rejects.toThrow();
        });

        it('should succeed if directory does not exist', async () => {
            const result = await storage.delete(categoryPath('nonexistent'));

            expect(result.ok()).toBe(true);
        });

        it('should delete nested directories recursively', async () => {
            await fs.mkdir(join(tempDir, 'parent', 'child'), { recursive: true });
            await fs.writeFile(join(tempDir, 'parent', 'child', 'file.md'), 'content');

            const result = await storage.delete(categoryPath('parent'));

            expect(result.ok()).toBe(true);
            await expect(fs.access(join(tempDir, 'parent'))).rejects.toThrow();
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
                categoryPath('parent/child'),
                'A child category',
            );

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent', 'index.yaml'), 'utf8');
            expect(content).toContain('A child category');
        });

        it('should create subcategory entry if not exists', async () => {
            await fs.mkdir(join(tempDir, 'parent2'), { recursive: true });
            const indexContent = 'memories: []\nsubcategories: []';
            await fs.writeFile(join(tempDir, 'parent2', 'index.yaml'), indexContent);

            const result = await storage.updateSubcategoryDescription(
                categoryPath('parent2/new-child'),
                'New child description',
            );

            expect(result.ok()).toBe(true);

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
                categoryPath('parent3/child'),
                null,
            );

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent3', 'index.yaml'), 'utf8');
            expect(content).not.toContain('Old description');
        });

        it('should create index file if parent does not have one', async () => {
            await fs.mkdir(join(tempDir, 'no-index-parent'), { recursive: true });

            const result = await storage.updateSubcategoryDescription(
                categoryPath('no-index-parent/child'),
                'Child category',
            );

            expect(result.ok()).toBe(true);

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

            const result = await storage.removeSubcategoryEntry(categoryPath('parent4/child1'));

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(join(tempDir, 'parent4', 'index.yaml'), 'utf8');
            expect(content).not.toContain('parent4/child1');
            expect(content).toContain('parent4/child2');
        });

        it('should succeed if parent index does not exist', async () => {
            const result = await storage.removeSubcategoryEntry(categoryPath('nonexistent/child'));

            expect(result.ok()).toBe(true);
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

            const result = await storage.removeSubcategoryEntry(categoryPath('parent5/nonexistent'));

            expect(result.ok()).toBe(true);

            // Existing entry should still be there
            const content = await fs.readFile(join(tempDir, 'parent5', 'index.yaml'), 'utf8');
            expect(content).toContain('parent5/existing');
        });
    });
});

