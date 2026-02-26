/**
 * Unit tests for cortex_remove_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { getMemoryHandler } from './get-memory.ts';
import { removeMemoryHandler, type RemoveMemoryInput } from './remove-memory.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockMemoryClient,
    errResult,
    okResult,
    expectMcpInvalidParams,
    expectMcpInternalError,
    expectTextResponseContains,
} from '../../test-helpers.spec.ts';

describe('cortex_remove_memory tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

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
            getMemoryHandler(ctx, { store: 'default', path: 'project/remove-target' }),
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

// ---------------------------------------------------------------------------
// removeMemoryHandler — unit tests using mocks
// ---------------------------------------------------------------------------

describe('removeMemoryHandler (unit)', () => {
    it('should throw McpError InvalidParams when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' })) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(
            () => removeMemoryHandler(ctx, { store: 'missing', path: 'cat/slug' }),
        );
    });

    it('should throw McpError InternalError when delete fails', async () => {
        const memClient = createMockMemoryClient({
            delete: mock(async () =>
                errResult({ code: 'STORAGE_ERROR', message: 'Disk error' }),
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

        await expectMcpInternalError(
            () => removeMemoryHandler(ctx, { store: 'default', path: 'cat/slug' }),
        );
    });

    it('should return text response containing "Memory removed at" on success', async () => {
        const ctx = createMockCortexContext();
        const result = await removeMemoryHandler(ctx, { store: 'default', path: 'cat/slug' });
        expectTextResponseContains(result, 'Memory removed at');
    });
});
