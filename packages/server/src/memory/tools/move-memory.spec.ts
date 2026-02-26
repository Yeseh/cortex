/**
 * Unit tests for cortex_move_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { getMemoryHandler } from './get-memory.ts';
import { moveMemoryHandler, type MoveMemoryInput } from './move-memory.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockMemoryClient,
    errResult,
    okResult,
    expectMcpInvalidParams,
    expectTextResponseContains,
} from '../../test-helpers.spec.ts';

describe('cortex_move_memory tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

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
            fromPath: 'project/move-source',
            toPath: 'project/move-destination',
        };

        const result = await moveMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory moved');

        await expect(
            getMemoryHandler(ctx, { store: 'default', path: 'project/move-source' }),
        ).rejects.toThrow('not found');

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/move-destination' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.content).toBe('Content to move');
    });

    it('should return error for non-existent source', async () => {
        const input: MoveMemoryInput = {
            store: 'default',
            fromPath: 'project/non-existent',
            toPath: 'project/destination',
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
            fromPath: 'project/move-source',
            toPath: 'project/existing-destination',
        };

        await expect(moveMemoryHandler(ctx, input)).rejects.toThrow('already exists');
    });
});

// ---------------------------------------------------------------------------
// moveMemoryHandler — unit tests using mocks
// ---------------------------------------------------------------------------

describe('moveMemoryHandler (unit)', () => {
    it('should throw McpError InvalidParams when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' })) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(
            () => moveMemoryHandler(ctx, { store: 'missing', fromPath: 'cat/old', toPath: 'cat/new' }),
        );
    });

    it('should throw via translateMemoryError when move returns DESTINATION_EXISTS', async () => {
        const memClient = createMockMemoryClient({
            move: mock(async () =>
                errResult({ code: 'DESTINATION_EXISTS', message: 'Already exists', path: 'cat/new' }),
            ) as any,
        });
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(
            () => moveMemoryHandler(ctx, { store: 'default', fromPath: 'cat/old', toPath: 'cat/new' }),
        );
    });

    it('should return text response containing "Memory moved from ... to ..." on success', async () => {
        const ctx = createMockCortexContext();
        const result = await moveMemoryHandler(ctx, {
            store: 'default',
            fromPath: 'cat/old',
            toPath: 'cat/new',
        });
        expectTextResponseContains(result, 'Memory moved from');
        expectTextResponseContains(result, 'cat/old');
        expectTextResponseContains(result, 'cat/new');
    });
});
