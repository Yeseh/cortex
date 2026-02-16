/**
 * Unit tests for cortex_prune_memories tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, registerStore } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { getMemoryHandler } from './get-memory.ts';
import { pruneMemoriesHandler, type PruneMemoriesInput } from './prune-memories.ts';

describe('cortex_prune_memories tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        const result = await createTestContext();
        testDir = result.testDir;
        ctx = result.ctx;

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/active', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Active memory',
        });

        await createMemoryFile(storeRoot, 'project/expired-1', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired 1',
        });

        await createMemoryFile(storeRoot, 'human/expired-2', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired 2',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should prune expired memories', async () => {
        const input: PruneMemoriesInput = {
            store: 'default',
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(2);
        expect(output.pruned).toHaveLength(2);

        const getResult = await getMemoryHandler(ctx, { store: 'default', path: 'project/active' });
        expect(getResult.content[0]!.text).toContain('Active memory');

        await expect(
            getMemoryHandler(ctx, { store: 'default', path: 'project/expired-1' })
        ).rejects.toThrow('not found');
    });

    it('should return zero when no memories are expired', async () => {
        const cleanStorePath = join(testDir, MEMORY_SUBDIR, 'clean');
        await registerStore(ctx, 'clean-store', cleanStorePath);

        await createMemoryFile(cleanStorePath, 'project/active', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Active',
        });

        const input: PruneMemoriesInput = {
            store: 'clean-store',
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(0);
        expect(output.pruned).toHaveLength(0);
    });

    it('should return what would be pruned in dry_run mode without deleting', async () => {
        const input: PruneMemoriesInput = {
            store: 'default',
            dry_run: true,
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(2);
        expect(output.would_prune).toHaveLength(2);

        const getResult1 = await getMemoryHandler(ctx, {
            store: 'default',
            path: 'project/expired-1',
            include_expired: true,
        });
        expect(getResult1.content[0]!.text).toContain('Expired 1');

        const getResult2 = await getMemoryHandler(ctx, {
            store: 'default',
            path: 'human/expired-2',
            include_expired: true,
        });
        expect(getResult2.content[0]!.text).toContain('Expired 2');
    });

    it('should return zero in dry_run mode when no memories are expired', async () => {
        const cleanStorePath = join(testDir, MEMORY_SUBDIR, 'clean');
        await registerStore(ctx, 'dry-clean-store', cleanStorePath);

        await createMemoryFile(cleanStorePath, 'project/active', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Active',
        });

        const input: PruneMemoriesInput = {
            store: 'dry-clean-store',
            dry_run: true,
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(0);
        expect(output.would_prune).toHaveLength(0);
    });
});
