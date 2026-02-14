import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { reindexCategoryIndexes, updateCategoryIndexes, readCategoryIndex } from './indexes.ts';
import type { FilesystemContext } from './types.ts';
import { CategoryPath, MemoryPath } from '@yeseh/cortex-core';

const categoryPath = (path: string): CategoryPath => CategoryPath.fromString(path).unwrap();
const memoryPath = (path: string): MemoryPath => MemoryPath.fromString(path).unwrap();

const MEMORY_CONTENT = [
    '---',
    'created_at: 2024-01-01T00:00:00.000Z',
    'updated_at: 2024-01-01T00:00:00.000Z',
    'tags: []',
    'source: test',
    '---',
    'Content here',
].join('\n');

describe('reindexCategoryIndexes', () => {
    let tempDir: string;
    let ctx: FilesystemContext;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-indexes-'));
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

    it('should remove stale index files for categories without memories', async () => {
        // Create categories
        await fs.mkdir(join(tempDir, 'alpha'), { recursive: true });
        await fs.mkdir(join(tempDir, 'beta'), { recursive: true });

        // Create memory files
        await fs.writeFile(join(tempDir, 'alpha', 'memory-a.md'), MEMORY_CONTENT);
        await fs.writeFile(join(tempDir, 'beta', 'memory-b.md'), MEMORY_CONTENT);

        // Create index files
        const rootIndex = [
            'memories: []',
            'subcategories:',
            '  - path: alpha',
            '    memory_count: 1',
            '  - path: beta',
            '    memory_count: 1',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'index.yaml'), rootIndex);

        const alphaIndex = [
            'memories:',
            '  - path: alpha/memory-a',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'alpha', 'index.yaml'), alphaIndex);

        const betaIndex = [
            'memories:',
            '  - path: beta/memory-b',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'beta', 'index.yaml'), betaIndex);

        // Delete beta memory (simulating prune)
        await fs.unlink(join(tempDir, 'beta', 'memory-b.md'));

        // Reindex
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.warnings).toEqual([]);
        }

        // beta/index.yaml should no longer exist
        await expect(fs.access(join(tempDir, 'beta', 'index.yaml'))).rejects.toThrow();

        // alpha/index.yaml should still exist
        await fs.access(join(tempDir, 'alpha', 'index.yaml'));

        // Root index should not contain beta
        const rootContent = await fs.readFile(join(tempDir, 'index.yaml'), 'utf8');
        expect(rootContent).not.toContain('beta');

        // Root index should still contain alpha
        expect(rootContent).toContain('alpha');
    });

    it('should handle nested categories where only leaf is empty', async () => {
        // Create nested categories
        await fs.mkdir(join(tempDir, 'a', 'b', 'c'), { recursive: true });
        await fs.mkdir(join(tempDir, 'a', 'b', 'd'), { recursive: true });

        // Create memory files
        await fs.writeFile(join(tempDir, 'a', 'b', 'c', 'memory.md'), MEMORY_CONTENT);
        await fs.writeFile(join(tempDir, 'a', 'b', 'd', 'memory.md'), MEMORY_CONTENT);

        // Create index files
        const aIndex = [
            'memories: []',
            'subcategories:',
            '  - path: a/b',
            '    memory_count: 0',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'a', 'index.yaml'), aIndex);

        const abIndex = [
            'memories: []',
            'subcategories:',
            '  - path: a/b/c',
            '    memory_count: 1',
            '  - path: a/b/d',
            '    memory_count: 1',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'a', 'b', 'index.yaml'), abIndex);

        const abcIndex = [
            'memories:',
            '  - path: a/b/c/memory',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'a', 'b', 'c', 'index.yaml'), abcIndex);

        const abdIndex = [
            'memories:',
            '  - path: a/b/d/memory',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'a', 'b', 'd', 'index.yaml'), abdIndex);

        // Delete leaf memory
        await fs.unlink(join(tempDir, 'a', 'b', 'c', 'memory.md'));

        // Reindex
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.warnings).toEqual([]);
        }

        // a/b/c/index.yaml should no longer exist
        await expect(fs.access(join(tempDir, 'a', 'b', 'c', 'index.yaml'))).rejects.toThrow();

        // a/b/d/index.yaml should still exist
        await fs.access(join(tempDir, 'a', 'b', 'd', 'index.yaml'));

        // a/b/index.yaml should still exist (still has subcategory d)
        await fs.access(join(tempDir, 'a', 'b', 'index.yaml'));
    });

    it('should not delete any index files when all categories have memories', async () => {
        // Create category with memory
        await fs.mkdir(join(tempDir, 'project'), { recursive: true });
        await fs.writeFile(join(tempDir, 'project', 'mem1.md'), MEMORY_CONTENT);

        // Create index files
        const rootIndex = [
            'memories: []',
            'subcategories:',
            '  - path: project',
            '    memory_count: 1',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'index.yaml'), rootIndex);

        const projectIndex = [
            'memories:',
            '  - path: project/mem1',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'project', 'index.yaml'), projectIndex);

        // Reindex
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.warnings).toEqual([]);
        }

        // All index files should still exist
        await fs.access(join(tempDir, 'index.yaml'));
        await fs.access(join(tempDir, 'project', 'index.yaml'));
    });

    it('should handle empty store gracefully', async () => {
        // Empty temp dir - no memory files, no index files
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.warnings).toEqual([]);
        }

        // No index files should have been created
        const entries = await fs.readdir(tempDir);
        const indexFiles = entries.filter((e) => e.endsWith('.yaml'));
        expect(indexFiles).toHaveLength(0);
    });

    it('should remove all stale indexes when store has no memory files', async () => {
        // Create stale index files with no memory files
        await fs.mkdir(join(tempDir, 'old-cat'), { recursive: true });

        const rootIndex = [
            'memories: []',
            'subcategories:',
            '  - path: old-cat',
            '    memory_count: 0',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'index.yaml'), rootIndex);

        const oldCatIndex = [
            'memories: []', 'subcategories: []',
        ].join('\n');
        await fs.writeFile(join(tempDir, 'old-cat', 'index.yaml'), oldCatIndex);

        // Reindex
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.warnings).toEqual([]);
        }

        // old-cat/index.yaml should no longer exist
        await expect(fs.access(join(tempDir, 'old-cat', 'index.yaml'))).rejects.toThrow();

        // root index.yaml should also be cleaned up (no memories means no index entries)
        await expect(fs.access(join(tempDir, 'index.yaml'))).rejects.toThrow();
    });

    it('should populate updatedAt in index entries from memory frontmatter', async () => {
        const updatedAt1 = new Date('2024-06-15T10:30:00.000Z');
        const updatedAt2 = new Date('2024-06-20T14:45:00.000Z');

        // Create memories with updatedAt in frontmatter
        const memory1 = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            `updated_at: ${updatedAt1.toISOString()}`,
            'tags: []',
            'source: test',
            '---',
            'Memory 1 content',
        ].join('\n');

        const memory2 = [
            '---',
            'created_at: 2024-01-15T00:00:00.000Z',
            `updated_at: ${updatedAt2.toISOString()}`,
            'tags: []',
            'source: test',
            '---',
            'Memory 2 content',
        ].join('\n');

        await fs.mkdir(join(tempDir, 'project'), { recursive: true });
        await fs.writeFile(join(tempDir, 'project', 'memory-1.md'), memory1);
        await fs.writeFile(join(tempDir, 'project', 'memory-2.md'), memory2);

        // Reindex
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);

        // Read and verify the index
        const indexResult = await readCategoryIndex(ctx, categoryPath('project'));

        expect(indexResult.ok()).toBe(true);
        if (indexResult.ok()) {
            const index = indexResult.value;
            expect(index.memories).toHaveLength(2);

            const entry1 = index.memories.find((m) => m.path.toString() === 'project/memory-1');
            expect(entry1).toBeDefined();
            expect(entry1?.updatedAt).toBeDefined();
            expect(entry1?.updatedAt?.toISOString()).toBe(updatedAt1.toISOString());

            const entry2 = index.memories.find((m) => m.path.toString() === 'project/memory-2');
            expect(entry2).toBeDefined();
            expect(entry2?.updatedAt).toBeDefined();
            expect(entry2?.updatedAt?.toISOString()).toBe(updatedAt2.toISOString());
        }
    });

    it('should handle memories without updatedAt in frontmatter during reindex', async () => {
        // Create a memory with malformed frontmatter (no updated_at)
        const memoryWithoutUpdatedAt = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'tags: []',
            'source: test',
            '---',
            'Memory without updatedAt',
        ].join('\n');

        await fs.mkdir(join(tempDir, 'project'), { recursive: true });
        await fs.writeFile(join(tempDir, 'project', 'memory-legacy.md'), memoryWithoutUpdatedAt);

        // Reindex should succeed, but entry should have undefined updatedAt
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok()).toBe(true);

        // Read and verify the index
        const indexResult = await readCategoryIndex(ctx, categoryPath('project'));

        expect(indexResult.ok()).toBe(true);
        if (indexResult.ok()) {
            const index = indexResult.value;
            expect(index.memories).toHaveLength(1);

            const entry = index.memories[0];
            expect(entry?.path.toString()).toBe('project/memory-legacy');
            expect(entry?.updatedAt).toBeUndefined();
        }
    });
});

describe('updateCategoryIndexes', () => {
    let tempDir: string;
    let ctx: FilesystemContext;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-update-indexes-'));
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

    it('should include updatedAt in index entry after create', async () => {
        const updatedAt = new Date('2024-06-15T10:30:00.000Z');
        const memoryContent = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            `updated_at: ${updatedAt.toISOString()}`,
            'tags: [test]',
            'source: test',
            '---',
            'Memory content',
        ].join('\n');

        // Create the memory and update indexes
        const result = await updateCategoryIndexes(
            ctx,
            memoryPath('project/cortex/test-memory'),
            memoryContent,
            { createWhenMissing: true },
        );

        expect(result.ok()).toBe(true);

        // Read the category index
        const indexResult = await readCategoryIndex(ctx, categoryPath('project/cortex'));
        expect(indexResult.ok()).toBe(true);

        if (indexResult.ok()) {
            const index = indexResult.value;
            expect(index.memories).toHaveLength(1);
            const entry = index.memories[0];
            expect(entry?.path.toString()).toBe('project/cortex/test-memory');
            expect(entry?.updatedAt).toBeDefined();
            expect(entry?.updatedAt?.toISOString()).toBe(updatedAt.toISOString());
        }
    });

    it('should update updatedAt in index entry after update', async () => {
        const createdAt = new Date('2024-01-01T00:00:00.000Z');
        const updatedAt = new Date('2024-06-20T14:45:00.000Z');

        // Create initial memory
        const initialContent = [
            '---',
            `created_at: ${createdAt.toISOString()}`,
            `updated_at: ${createdAt.toISOString()}`,
            'tags: [test]',
            'source: test',
            '---',
            'Initial content',
        ].join('\n');

        await updateCategoryIndexes(ctx, memoryPath('project/test-memory'), initialContent, {
            createWhenMissing: true,
        });

        // Update the memory with new timestamp
        const updatedContent = [
            '---',
            `created_at: ${createdAt.toISOString()}`,
            `updated_at: ${updatedAt.toISOString()}`,
            'tags: [test, updated]',
            'source: test',
            '---',
            'Updated content',
        ].join('\n');

        const updateResult = await updateCategoryIndexes(
            ctx,
            memoryPath('project/test-memory'),
            updatedContent,
            { createWhenMissing: true },
        );

        expect(updateResult.ok()).toBe(true);

        // Verify the index has the updated timestamp
        const indexResult = await readCategoryIndex(ctx, categoryPath('project'));
        expect(indexResult.ok()).toBe(true);

        if (indexResult.ok()) {
            const index = indexResult.value;
            expect(index.memories).toHaveLength(1);
            const entry = index.memories[0];
            expect(entry?.path.toString()).toBe('project/test-memory');
            expect(entry?.updatedAt).toBeDefined();
            expect(entry?.updatedAt?.toISOString()).toBe(updatedAt.toISOString());
        }
    });

    it('should handle memory without updatedAt field gracefully', async () => {
        // Memory with only created_at (legacy format)
        const memoryContent = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'tags: []',
            'source: test',
            '---',
            'Content',
        ].join('\n');

        // This should fail during parsing because updatedAt is required
        const result = await updateCategoryIndexes(
            ctx,
            memoryPath('project/legacy-memory'),
            memoryContent,
            {
                createWhenMissing: true,
            },
        );

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INDEX_ERROR');
        }
    });
});
