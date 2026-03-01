/**
 * Unit tests for cortex_prune_memories tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import {
    createMemoryFile,
    createTestContext,
    createTestContextWithStores,
    createTestDir,
} from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { ok, err } from '@yeseh/cortex-core';
import { getMemoryHandler } from './get-memory.ts';
import { pruneMemoriesHandler, type PruneMemoriesInput } from './prune-memories.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockCategoryClient,
    expectMcpInvalidParams,
    expectMcpInternalError,
    parseResponseJson,
} from '../../test-helpers.spec.ts';

describe('cortex_prune_memories tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

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
            store: 'global',
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(2);
        expect(output.pruned).toHaveLength(2);

        const getResult = await getMemoryHandler(ctx, { store: 'global', path: 'project/active' });
        expect(getResult.content[0]!.text).toContain('Active memory');

        await expect(
            getMemoryHandler(ctx, { store: 'global', path: 'project/expired-1' })
        ).rejects.toThrow('not found');
    });

    it('should return zero when no memories are expired', async () => {
        const cleanStorePath = join(testDir, 'clean-store');
        await mkdir(cleanStorePath, { recursive: true });
        const ctxWithStores = createTestContextWithStores(testDir, {
            'clean-store': cleanStorePath,
        });

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

        const result = await pruneMemoriesHandler(ctxWithStores, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(0);
        expect(output.pruned).toHaveLength(0);
    });

    it('should return what would be pruned in dry_run mode without deleting', async () => {
        const input: PruneMemoriesInput = {
            store: 'global',
            dry_run: true,
        };

        const result = await pruneMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(2);
        expect(output.would_prune).toHaveLength(2);

        const getResult1 = await getMemoryHandler(ctx, {
            store: 'global',
            path: 'project/expired-1',
            include_expired: true,
        });
        expect(getResult1.content[0]!.text).toContain('Expired 1');

        const getResult2 = await getMemoryHandler(ctx, {
            store: 'global',
            path: 'human/expired-2',
            include_expired: true,
        });
        expect(getResult2.content[0]!.text).toContain('Expired 2');
    });

    it('should return zero in dry_run mode when no memories are expired', async () => {
        const cleanStorePath = join(testDir, 'dry-clean-store');
        await mkdir(cleanStorePath, { recursive: true });
        const ctxWithStores = createTestContextWithStores(testDir, {
            'dry-clean-store': cleanStorePath,
        });

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

        const result = await pruneMemoriesHandler(ctxWithStores, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(0);
        expect(output.would_prune).toHaveLength(0);
    });
});

// =============================================================================
// Unit tests — mock-based, no filesystem
// =============================================================================

describe('pruneMemoriesHandler (unit)', () => {
    it('should throw McpError(InvalidParams) when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(
                    () => err({ code: 'STORE_NOT_FOUND', message: 'Store not found' }) as any
                ),
            }) as any,
        });

        await expectMcpInvalidParams(() => pruneMemoriesHandler(ctx, { store: 'missing' }));
    });

    it('should throw McpError(InternalError) when store.root() fails', async () => {
        const storeClient = createMockStoreClient({
            root: mock(() => err({ code: 'STORAGE_ERROR', message: 'Root unavailable' }) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInternalError(() => pruneMemoriesHandler(ctx, { store: 'global' }));
    });

    it('should throw McpError(InternalError) when prune() fails', async () => {
        const rootCategory = createMockCategoryClient({
            prune: mock(async () => err({ code: 'STORAGE_ERROR', message: 'Prune failed' }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInternalError(() => pruneMemoriesHandler(ctx, { store: 'global' }));
    });

    it('should return dry_run response with would_prune list when dryRun=true', async () => {
        const expiresAt = new Date('2024-01-01');
        const rootCategory = createMockCategoryClient({
            prune: mock(
                async () =>
                    ok({
                        pruned: [{ path: { toString: () => 'project/old-memory' }, expiresAt }],
                        dryRun: true,
                    }) as any
            ),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await pruneMemoriesHandler(ctx, { store: 'global', dry_run: true });
        const output = parseResponseJson(result) as any;

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(1);
        expect(Array.isArray(output.would_prune)).toBe(true);
        expect(output.would_prune).toHaveLength(1);
        expect(output.would_prune[0].path).toBe('project/old-memory');
        expect(output.would_prune[0].expires_at).toBe(expiresAt.toISOString());
        // dry-run response must NOT have pruned_count
        expect(output.pruned_count).toBeUndefined();
    });

    it('should return pruned response when dryRun=false', async () => {
        const expiresAt = new Date('2023-06-01');
        const rootCategory = createMockCategoryClient({
            prune: mock(
                async () =>
                    ok({
                        pruned: [
                            { path: { toString: () => 'stale/memory-a' }, expiresAt },
                            { path: { toString: () => 'stale/memory-b' }, expiresAt },
                        ],
                        dryRun: false,
                    }) as any
            ),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await pruneMemoriesHandler(ctx, { store: 'global', dry_run: false });
        const output = parseResponseJson(result) as any;

        expect(output.pruned_count).toBe(2);
        expect(Array.isArray(output.pruned)).toBe(true);
        expect(output.pruned).toHaveLength(2);
        // actual prune response must NOT have dry_run or would_prune
        expect(output.dry_run).toBeUndefined();
        expect(output.would_prune).toBeUndefined();
    });

    it('should return pruned_count=0 and empty pruned array when nothing is expired', async () => {
        const rootCategory = createMockCategoryClient({
            prune: mock(async () => ok({ pruned: [], dryRun: false }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await pruneMemoriesHandler(ctx, { store: 'global' });
        const output = parseResponseJson(result) as any;

        expect(output.pruned_count).toBe(0);
        expect(output.pruned).toEqual([]);
    });

    // -------------------------------------------------------------------------
    // Logging behaviour
    // -------------------------------------------------------------------------

    describe('logging', () => {
        const createSpyLogger = () => ({
            debug: mock((_msg: string, _meta?: Record<string, unknown>) => {}),
            info:  mock((_msg: string, _meta?: Record<string, unknown>) => {}),
            warn:  mock((_msg: string, _meta?: Record<string, unknown>) => {}),
            error: mock((_msg: string, _err?: unknown, _meta?: Record<string, unknown>) => {}),
        });

        it('should log "invoked" and "succeeded" with dry_run and count on success', async () => {
            const logger = createSpyLogger();
            const rootCategory = createMockCategoryClient({
                prune: mock(async () => ok({ pruned: [], dryRun: false }) as any),
            });
            const storeClient = createMockStoreClient({
                root: mock(() => ok(rootCategory) as any),
            });
            const ctx = createMockCortexContext({
                logger,
                cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
            });

            await pruneMemoriesHandler(ctx, { store: 'global', dry_run: false });

            const invokedCall = logger.debug.mock.calls.find(
                ([msg]) => msg === 'cortex_prune_memories invoked',
            );
            expect(invokedCall).toBeDefined();
            expect(invokedCall![1]?.store).toBe('global');
            expect(invokedCall![1]?.dry_run).toBe(false);

            const succeededCall = logger.debug.mock.calls.find(
                ([msg]) => msg === 'cortex_prune_memories succeeded',
            );
            expect(succeededCall).toBeDefined();
            expect(succeededCall![1]?.store).toBe('global');
            expect(succeededCall![1]?.dry_run).toBe(false);
            expect(succeededCall![1]?.count).toBe(0);
        });

        it('should log "failed" (debug) when store resolution fails', async () => {
            const logger = createSpyLogger();
            const ctx = createMockCortexContext({
                logger,
                cortex: createMockCortex({
                    getStore: mock(() => err({ code: 'STORE_NOT_FOUND', message: 'Store not found' }) as any),
                }) as any,
            });

            await expectMcpInvalidParams(() => pruneMemoriesHandler(ctx, { store: 'missing' }));

            const failedCall = logger.debug.mock.calls.find(
                ([msg]) => msg === 'cortex_prune_memories failed',
            );
            expect(failedCall).toBeDefined();
            expect(failedCall![1]?.store).toBe('missing');
            expect(failedCall![1]?.error_code).toBe('STORE_NOT_FOUND');
        });

        it('should log "failed" (error) when store.root() fails', async () => {
            const logger = createSpyLogger();
            const storeClient = createMockStoreClient({
                root: mock(() => err({ code: 'STORAGE_ERROR', message: 'Root unavailable' }) as any),
            });
            const ctx = createMockCortexContext({
                logger,
                cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
            });

            await expectMcpInternalError(() => pruneMemoriesHandler(ctx, { store: 'global' }));

            const failedCall = logger.error.mock.calls.find(
                ([msg]) => msg === 'cortex_prune_memories failed',
            );
            expect(failedCall).toBeDefined();
            expect(failedCall![2]?.store).toBe('global');
            expect(failedCall![2]?.error_code).toBe('STORAGE_ERROR');
        });

        it('should log "failed" (error) when prune() fails', async () => {
            const logger = createSpyLogger();
            const rootCategory = createMockCategoryClient({
                prune: mock(async () => err({ code: 'STORAGE_ERROR', message: 'Prune failed' }) as any),
            });
            const storeClient = createMockStoreClient({
                root: mock(() => ok(rootCategory) as any),
            });
            const ctx = createMockCortexContext({
                logger,
                cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
            });

            await expectMcpInternalError(() => pruneMemoriesHandler(ctx, { store: 'global' }));

            const failedCall = logger.error.mock.calls.find(
                ([msg]) => msg === 'cortex_prune_memories failed',
            );
            expect(failedCall).toBeDefined();
            expect(failedCall![2]?.store).toBe('global');
            expect(failedCall![2]?.error_code).toBe('STORAGE_ERROR');
        });
    });
});
