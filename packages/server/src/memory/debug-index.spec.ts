import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import { CategoryPath } from '@yeseh/cortex-core';
import { createMemoryFile, createTestDir } from './tools/test-utils.ts';
import { MEMORY_SUBDIR } from '../config.ts';
import { readCategoryListing } from './resources.ts';

describe('Debug resources test setup', () => {
    let testDir: string;
    let storeRoot: string;
    let adapter: FilesystemStorageAdapter;

    beforeEach(async () => {
        testDir = await createTestDir();
        storeRoot = join(testDir, MEMORY_SUBDIR);
        adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should work like resources.spec.ts test', async () => {
        // Exact same setup as resources.spec.ts
        await createMemoryFile(storeRoot, 'project/memory-1', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Memory 1',
        });

        console.log('[1] Memory created');

        // List files
        const files = await readdir(storeRoot, { recursive: true });
        console.log('[2] Files:', files);

        // Check index directly
        const projectPath = CategoryPath.fromString('project');
        if (projectPath.ok()) {
            const indexResult = await adapter.indexes.read(projectPath.value);
            console.log('[3] Direct index read:', {
                ok: indexResult.ok(),
                value: indexResult.value,
            });
        }

        // Now try through readCategoryListing
        const result = await readCategoryListing(adapter, 'default', 'project');
        console.log('[4] readCategoryListing result:', {
            ok: result.ok(),
            error: result.ok() ? null : result.error,
        });

        expect(result.ok()).toBe(true);
    });
});
