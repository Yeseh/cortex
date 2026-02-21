/**
 * Unit tests for cortex_get_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { getMemoryHandler, type GetMemoryInput } from './get-memory.ts';

describe('cortex_get_memory tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/existing-memory', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['existing'],
                source: 'test',
                citations: [],
            },
            content: 'Existing content',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should retrieve a memory', async () => {
        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/existing-memory',
        };

        const result = await getMemoryHandler(ctx, input);

        const output = JSON.parse(result.content[0]!.text);
        expect(output.path).toBe('project/existing-memory');
        expect(output.content).toBe('Existing content');
        expect(output.metadata.tags).toEqual(['existing']);
        expect(output.metadata.source).toBe('test');
    });

    it('should return error for non-existent memory', async () => {
        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
        };

        await expect(getMemoryHandler(ctx, input)).rejects.toThrow('not found');
    });

    it('should not return expired memory by default', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-memory', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired content',
        });

        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/expired-memory',
        };

        await expect(getMemoryHandler(ctx, input)).rejects.toThrow('expired');
    });

    it('should return expired memory when include_expired is true', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-memory-2', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired content',
        });

        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/expired-memory-2',
            include_expired: true,
        };

        const result = await getMemoryHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);
        expect(output.content).toBe('Expired content');
    });
});
