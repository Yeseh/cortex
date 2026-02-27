/**
 * Unit tests for cortex_reindex_store tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { ok, err } from '@yeseh/cortex-core';
import { reindexStoreHandler, type ReindexStoreInput } from './reindex-store.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockCategoryClient,
    expectMcpInvalidParams,
    expectMcpInternalError,
    parseResponseJson,
} from '../../test-helpers.spec.ts';

describe('cortex_reindex_store tool', () => {
    let testDir: string;
    let ctx: CortexContext;

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
            store: 'global',
        };

        const result = await reindexStoreHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.store).toBe('global');
        expect(Array.isArray(output.warnings)).toBe(true);
        expect(output.warnings).toEqual([]);
    });

    it('should return error for non-existent store', async () => {
        const input: ReindexStoreInput = {
            store: 'non-existent-store',
        };

        await expect(reindexStoreHandler(ctx, input)).rejects.toThrow('not registered');
    });

    it('should work with empty store', async () => {
        const input: ReindexStoreInput = {
            store: 'global',
        };

        const result = await reindexStoreHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.store).toBe('global');
        expect(output.warnings).toEqual([]);
    });
});

// =============================================================================
// Unit tests — mock-based, no filesystem
// =============================================================================

describe('reindexStoreHandler (unit)', () => {
    it('should throw McpError(InvalidParams) when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => err({ code: 'STORE_NOT_FOUND', message: 'Store not found' }) as any),
            }) as any,
        });

        await expectMcpInvalidParams(() =>
            reindexStoreHandler(ctx, { store: 'missing' }),
        );
    });

    it('should throw McpError(InternalError) when store.root() fails', async () => {
        const storeClient = createMockStoreClient({
            root: mock(() => err({ code: 'STORAGE_ERROR', message: 'Root unavailable' }) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInternalError(() =>
            reindexStoreHandler(ctx, { store: 'global' }),
        );
    });

    it('should throw McpError(InternalError) when reindex() fails', async () => {
        const rootCategory = createMockCategoryClient({
            reindex: mock(async () => err({ code: 'STORAGE_ERROR', message: 'Reindex failed' }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInternalError(() =>
            reindexStoreHandler(ctx, { store: 'global' }),
        );
    });

    it('should return store name and empty warnings on success', async () => {
        const rootCategory = createMockCategoryClient({
            reindex: mock(async () => ok({ warnings: [] }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await reindexStoreHandler(ctx, { store: 'global' });
        const output = parseResponseJson(result) as any;

        expect(output.store).toBe('global');
        expect(output.warnings).toEqual([]);
    });

    it('should pass through warnings returned by reindex()', async () => {
        const rootCategory = createMockCategoryClient({
            reindex: mock(async () => ok({
                warnings: [
                    'Warning: file xyz.md has invalid path',
                    'Warning: duplicate slug detected in project/',
                ],
            }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await reindexStoreHandler(ctx, { store: 'global' });
        const output = parseResponseJson(result) as any;

        expect(output.store).toBe('global');
        expect(Array.isArray(output.warnings)).toBe(true);
        expect(output.warnings).toHaveLength(2);
        expect(output.warnings[0]).toBe('Warning: file xyz.md has invalid path');
        expect(output.warnings[1]).toBe('Warning: duplicate slug detected in project/');
    });
});
