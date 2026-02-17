/**
 * Unit tests for cortex_reindex_store tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { reindexStoreHandler, type ReindexStoreInput } from './reindex-store.ts';

describe('cortex_reindex_store tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should rebuild category indexes successfully', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/test-memory', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Test content',
        });

        const input: ReindexStoreInput = {
            store: 'default',
        };

        const result = await reindexStoreHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.store).toBe('default');
        expect(output.warnings).toBeDefined();
        expect(Array.isArray(output.warnings)).toBe(true);
    });

    it('should return error for non-existent store', async () => {
        const input: ReindexStoreInput = {
            store: 'non-existent-store',
        };

        await expect(reindexStoreHandler(ctx, input)).rejects.toThrow('not registered');
    });

    it('should work with empty store', async () => {
        const input: ReindexStoreInput = {
            store: 'default',
        };

        const result = await reindexStoreHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.store).toBe('default');
        expect(output.warnings).toEqual([]);
    });
});
