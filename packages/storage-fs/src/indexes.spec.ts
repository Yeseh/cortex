import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { reindexCategoryIndexes } from './indexes.ts';
import type { FilesystemContext } from './types.ts';

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

        expect(result.ok).toBe(true);
        if (result.ok) {
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

        expect(result.ok).toBe(true);
        if (result.ok) {
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

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.warnings).toEqual([]);
        }

        // All index files should still exist
        await fs.access(join(tempDir, 'index.yaml'));
        await fs.access(join(tempDir, 'project', 'index.yaml'));
    });

    it('should handle empty store gracefully', async () => {
        // Empty temp dir - no memory files, no index files
        const result = await reindexCategoryIndexes(ctx);

        expect(result.ok).toBe(true);
        if (result.ok) {
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

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.warnings).toEqual([]);
        }

        // old-cat/index.yaml should no longer exist
        await expect(fs.access(join(tempDir, 'old-cat', 'index.yaml'))).rejects.toThrow();

        // root index.yaml should also be cleaned up (no memories means no index entries)
        await expect(fs.access(join(tempDir, 'index.yaml'))).rejects.toThrow();
    });
});
