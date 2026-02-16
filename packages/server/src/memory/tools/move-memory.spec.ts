/**
 * Unit tests for cortex_move_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { getMemoryHandler } from './get-memory.ts';
import { moveMemoryHandler, type MoveMemoryInput } from './move-memory.ts';

describe('cortex_move_memory tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        const result = await createTestContext();
        testDir = result.testDir;
        ctx = result.ctx;

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/move-source', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['movable'],
                source: 'test',
                citations: [],
            },
            content: 'Content to move',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should move a memory', async () => {
        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/move-source',
            to_path: 'project/move-destination',
        };

        const result = await moveMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory moved');

        await expect(
            getMemoryHandler(ctx, { store: 'default', path: 'project/move-source' })
        ).rejects.toThrow('not found');

        const getResult = await getMemoryHandler(ctx, {
            store: 'default',
            path: 'project/move-destination',
        });
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.content).toBe('Content to move');
    });

    it('should return error for non-existent source', async () => {
        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/non-existent',
            to_path: 'project/destination',
        };

        await expect(moveMemoryHandler(ctx, input)).rejects.toThrow('not found');
    });

    it('should return error when destination exists', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/existing-destination', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Existing at destination',
        });

        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/move-source',
            to_path: 'project/existing-destination',
        };

        await expect(moveMemoryHandler(ctx, input)).rejects.toThrow('already exists');
    });
});
