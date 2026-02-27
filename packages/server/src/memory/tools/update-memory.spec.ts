/**
 * Unit tests for cortex_update_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { getMemoryHandler } from './get-memory.ts';
import { updateMemoryHandler, type UpdateMemoryInput } from './update-memory.ts';
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

describe('cortex_update_memory tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/update-target', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['original'],
                source: 'test',
                citations: [],
            },
            content: 'Original content',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should update memory content', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            content: 'Updated content',
        };

        const result = await updateMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory updated');

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/update-target' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.content).toBe('Updated content');
    });

    it('should update memory tags', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            tags: ['new-tag'],
        };

        await updateMemoryHandler(ctx, input);

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/update-target' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.tags).toEqual(['new-tag']);
    });

    it('should update expiry', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            expires_at: futureDate,
        };

        await updateMemoryHandler(ctx, input);

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/update-target' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBe(futureDate);
    });

    it('should clear expiry', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/with-expiry', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date(Date.now() + 86400000),
                citations: [],
            },
            content: 'Content with expiry',
        });

        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/with-expiry',
            expires_at: null,
        };

        await updateMemoryHandler(ctx, input);

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/with-expiry' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeUndefined();
    });

    it('should preserve existing expiry when expires_at is omitted', async () => {
        const expiryDate = new Date('2030-06-15T00:00:00.000Z');
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/preserve-expiry', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: expiryDate,
                citations: [],
            },
            content: 'Has expiry',
        });

        const updateInput: UpdateMemoryInput = {
            store: 'default',
            path: 'project/preserve-expiry',
            content: 'Updated content',
        };
        await updateMemoryHandler(ctx, updateInput);

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/preserve-expiry' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBe(expiryDate.toISOString());
    });

    it('should reject update with no changes', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
        };

        await expect(updateMemoryHandler(ctx, input)).rejects.toThrow('No updates');
    });

    it('should return error for non-existent memory', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
            content: 'New content',
        };

        await expect(updateMemoryHandler(ctx, input)).rejects.toThrow('not found');
    });
});

// ---------------------------------------------------------------------------
// updateMemoryHandler — unit tests using mocks
// ---------------------------------------------------------------------------

describe('updateMemoryHandler (unit)', () => {
    it('should throw McpError InvalidParams when no update fields are provided', async () => {
        const ctx = createMockCortexContext();
        await expectMcpInvalidParams(
            () => updateMemoryHandler(ctx, { store: 'default', path: 'cat/slug' }),
            'No updates',
        );
    });

    it('should succeed when only content is provided (partial update)', async () => {
        const ctx = createMockCortexContext();
        const result = await updateMemoryHandler(ctx, {
            store: 'default',
            path: 'cat/slug',
            content: 'New content',
        });
        expectTextResponseContains(result, 'Memory updated at');
    });

    it('should throw McpError InvalidParams when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' })) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(
            () => updateMemoryHandler(ctx, { store: 'missing', path: 'cat/slug', content: 'x' }),
        );
    });

    it('should throw via translateMemoryError when update returns an error', async () => {
        const memClient = createMockMemoryClient({
            update: mock(async () =>
                errResult({ code: 'MEMORY_NOT_FOUND', message: 'Not found', path: 'cat/slug' }),
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
            () => updateMemoryHandler(ctx, { store: 'default', path: 'cat/slug', content: 'x' }),
        );
    });

    it('should return text response containing "Memory updated at" on success', async () => {
        const ctx = createMockCortexContext();
        const result = await updateMemoryHandler(ctx, {
            store: 'default',
            path: 'cat/slug',
            content: 'updated',
        });
        expectTextResponseContains(result, 'Memory updated at');
    });

    it('should pass expires_at: null as null to clear expiry', async () => {
        const memClient = createMockMemoryClient();
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await updateMemoryHandler(ctx, {
            store: 'default',
            path: 'cat/slug',
            expires_at: null,
        });

        const calls = memClient.update.mock.calls as unknown as [{ expiresAt: null | undefined }][];
        expect(calls[0]![0].expiresAt).toBeNull();
    });
});
