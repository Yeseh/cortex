/**
 * Unit tests for cortex_add_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createTestCategory, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler } from './get-memory.ts';
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

describe('cortex_add_memory tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new memory', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createTestCategory(storeRoot, 'project');

        const input: AddMemoryInput = {
            store: 'global',
            path: 'project/test-memory',
            content: 'Test content',
        };

        const result = await addMemoryHandler(ctx, input);

        expect(result.content).toHaveLength(1);
        expect(result.content[0]!.text).toContain('Memory created');
        expect(result.content[0]!.text).toContain('project/test-memory');
    });

    it('should create a memory with tags', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createTestCategory(storeRoot, 'project');

        const input: AddMemoryInput = {
            store: 'global',
            path: 'project/tagged-memory',
            content: 'Content with tags',
            tags: [
                'test', 'example',
            ],
        };

        const result = await addMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(ctx, {
            store: 'global',
            path: 'project/tagged-memory',
        });
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.tags).toEqual([
            'test', 'example',
        ]);
    });

    it('should create a memory with expiration', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createTestCategory(storeRoot, 'project');

        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const input: AddMemoryInput = {
            store: 'global',
            path: 'project/expiring-memory',
            content: 'Expiring content',
            expires_at: futureDate,
        };

        const result = await addMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(ctx, {
            store: 'global',
            path: 'project/expiring-memory',
        });
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeDefined();
    });

    it('should reject unregistered store names', async () => {
        const input: AddMemoryInput = {
            store: 'unregistered-store',
            path: 'project/memory-in-new-store',
            content: 'Content in new store',
        };

        await expect(addMemoryHandler(ctx, input)).rejects.toThrow('not registered');
    });

    it('should reject invalid paths', async () => {
        const input: AddMemoryInput = {
            store: 'global',
            path: 'invalid',
            content: 'Content',
        };

        await expect(addMemoryHandler(ctx, input)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// addMemoryHandler — unit tests using mocks
// ---------------------------------------------------------------------------

describe('addMemoryHandler (unit)', () => {
    it('should throw McpError InvalidParams when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() =>
                    errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' }),
                ) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await expectMcpInvalidParams(() =>
            addMemoryHandler(ctx, { store: 'missing', path: 'cat/slug', content: 'x' }),
        );
    });

    it('should return text response containing "Memory created at" on success', async () => {
        const ctx = createMockCortexContext();
        const result = await addMemoryHandler(ctx, {
            store: 'global',
            path: 'cat/slug',
            content: 'Hello world',
        });
        expectTextResponseContains(result, 'Memory created at');
    });

    it('should throw via translateMemoryError when create returns MEMORY_NOT_FOUND', async () => {
        const memClient = createMockMemoryClient({
            create: mock(async () =>
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

        await expectMcpInvalidParams(() =>
            addMemoryHandler(ctx, { store: 'global', path: 'cat/slug', content: 'x' }),
        );
    });

    it('should parse expires_at as a Date when provided', async () => {
        const memClient = createMockMemoryClient();
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        const expiresAt = '2030-01-01T00:00:00.000Z';
        await addMemoryHandler(ctx, {
            store: 'global',
            path: 'cat/slug',
            content: 'x',
            expires_at: expiresAt,
        });

        // Access mock calls via unknown cast to bypass strict empty-tuple typing
        const calls = memClient.create.mock.calls as unknown as [
            { metadata: { expiresAt: Date } },
        ][];
        const createArgs = calls[0]![0];
        expect(createArgs.metadata.expiresAt).toBeInstanceOf(Date);
        expect(createArgs.metadata.expiresAt.toISOString()).toBe(expiresAt);
    });

    it('should pass tags through to create', async () => {
        const memClient = createMockMemoryClient();
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await addMemoryHandler(ctx, {
            store: 'global',
            path: 'cat/slug',
            content: 'x',
            tags: [
                'alpha', 'beta',
            ],
        });

        const calls = memClient.create.mock.calls as unknown as [
            { metadata: { tags: string[] } },
        ][];
        const createArgs = calls[0]![0];
        expect(createArgs.metadata.tags).toEqual([
            'alpha', 'beta',
        ]);
    });

    it('should pass citations through to create', async () => {
        const memClient = createMockMemoryClient();
        const storeClient = createMockStoreClient({
            getMemory: mock(() => memClient),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => okResult(storeClient)) as any,
            }) as unknown as CortexContext['cortex'],
        });

        await addMemoryHandler(ctx, {
            store: 'global',
            path: 'cat/slug',
            content: 'x',
            citations: [
                'docs/spec.md', 'https://example.com',
            ],
        });

        const calls = memClient.create.mock.calls as unknown as [
            { metadata: { citations: string[] } },
        ][];
        const createArgs = calls[0]![0];
        expect(createArgs.metadata.citations).toEqual([
            'docs/spec.md', 'https://example.com',
        ]);
    });
});
