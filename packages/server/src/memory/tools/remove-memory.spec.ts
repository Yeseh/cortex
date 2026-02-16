/**
 * Unit tests for cortex_remove_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { getMemoryHandler } from './get-memory.ts';
import { removeMemoryHandler, type RemoveMemoryInput } from './remove-memory.ts';

describe('cortex_remove_memory tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        const result = await createTestContext();
        testDir = result.testDir;
        ctx = result.ctx;

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/remove-target', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Content to remove',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should remove a memory', async () => {
        const input: RemoveMemoryInput = {
            store: 'default',
            path: 'project/remove-target',
        };

        const result = await removeMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory removed');

        await expect(
            getMemoryHandler(ctx, { store: 'default', path: 'project/remove-target' })
        ).rejects.toThrow('not found');
    });

    it('should return error for non-existent memory', async () => {
        const input: RemoveMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
        };

        await expect(removeMemoryHandler(ctx, input)).rejects.toThrow('not found');
    });
});
