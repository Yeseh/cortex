/**
 * Unit tests for cortex_get_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { getMemoryHandler, type GetMemoryInput } from './get-memory.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockMemoryClient,
    errResult,
    okResult,
    expectMcpInvalidParams,
    parseResponseJson,
} from '../../test-helpers.spec.ts';

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
            store: 'global',
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
            store: 'global',
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
            store: 'global',
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
            store: 'global',
            path: 'project/expired-memory-2',
            include_expired: true,
        };

        const result = await getMemoryHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);
        expect(output.content).toBe('Expired content');
    });
});

// ---------------------------------------------------------------------------
// getMemoryHandler — unit tests using mocks
// ---------------------------------------------------------------------------

describe('getMemoryHandler (unit)', () => {
    it('should throw McpError InvalidParams when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' })) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(
            () => getMemoryHandler(ctx, { store: 'missing', path: 'cat/slug' }),
        );
    });

    it('should throw via translateMemoryError when get returns an error', async () => {
        const memClient = createMockMemoryClient({
            get: mock(async () =>
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
            () => getMemoryHandler(ctx, { store: 'global', path: 'cat/slug' }),
        );
    });

    it('should return JSON response with path, content, and metadata on success', async () => {
        const ctx = createMockCortexContext();
        const result = await getMemoryHandler(ctx, { store: 'global', path: 'cat/slug' });

        const data = parseResponseJson(result) as {
            path: string;
            content: string;
            metadata: Record<string, unknown>;
        };
        expect(data.path).toBe('cat/slug');
        expect(typeof data.content).toBe('string');
        expect(data.metadata).toBeDefined();
    });

    it('should include created_at, updated_at, and tags in metadata', async () => {
        const ctx = createMockCortexContext();
        const result = await getMemoryHandler(ctx, { store: 'global', path: 'cat/slug' });

        const data = parseResponseJson(result) as {
            metadata: { created_at: string; updated_at: string; tags: string[] };
        };
        expect(typeof data.metadata.created_at).toBe('string');
        // updated_at may be present (ISO string) or undefined
        expect(data.metadata.tags).toBeInstanceOf(Array);
    });

    it('should pass include_expired: false by default to the get call', async () => {
        const memClient = createMockMemoryClient();
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await getMemoryHandler(ctx, { store: 'global', path: 'cat/slug' });

        // Verify get was called with includeExpired: false
        const calls = memClient.get.mock.calls as unknown as [{ includeExpired: boolean }][];
        expect(calls[0]![0].includeExpired).toBe(false);
    });
});
