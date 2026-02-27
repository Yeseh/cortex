/**
 * Unit tests for cortex_list_memories tool.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { FilesystemConfigAdapter, FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { listMemoriesHandler, type ListMemoriesInput } from './list-memories.ts';
import { CategoryPath, ok, err } from '@yeseh/cortex-core';
import {
    createMockCortexContext,
    createMockCortex,
    createMockStoreClient,
    createMockCategoryClient,
    createMockMemoryClient,
    expectMcpInvalidParams,
    parseResponseJson,
} from '../../test-helpers.spec.ts';

const categoryPath = (path: string): CategoryPath => CategoryPath.fromString(path).unwrap();

describe('cortex_list_memories tool', () => {
    let testDir: string;
    let ctx: CortexContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/memory-1', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Memory 1',
        });

        await createMemoryFile(storeRoot, 'project/memory-2', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Memory 2',
        });

        await createMemoryFile(storeRoot, 'human/preference', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'Human preference',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should list memories in a category', async () => {
        const input: ListMemoriesInput = {
            store: 'global',
            category: 'project',
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('project');
        expect(output.count).toBe(2);
        expect(output.memories).toHaveLength(2);
    });

    it('should list all memories when no category specified', async () => {
        const input: ListMemoriesInput = {
            store: 'global',
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('all');
        expect(output.count).toBe(3);
    });

    it('should exclude expired memories by default', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired',
        });

        const input: ListMemoriesInput = {
            store: 'global',
            category: 'project',
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(2);
    });

    it('should include expired memories when flag is set', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-2', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
                citations: [],
            },
            content: 'Expired',
        });

        const input: ListMemoriesInput = {
            store: 'global',
            category: 'project',
            includeExpired: true,
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(3);
    });

    it('should include subcategory descriptions in response', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        const configAdapter = new FilesystemConfigAdapter(join(testDir, 'config.yaml'));
        const adapter = new FilesystemStorageAdapter(configAdapter, { rootDirectory: storeRoot });

        await adapter.indexes.write(categoryPath('project'), {
            memories: [],
            subcategories: [
                { path: categoryPath('project/cortex'), memoryCount: 0, description: 'Cortex memory system' },
                { path: categoryPath('project/other'), memoryCount: 0 },
            ],
        });

        const input: ListMemoriesInput = {
            store: 'global',
            category: 'project',
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.subcategories).toBeDefined();
        expect(output.subcategories).toHaveLength(2);

        const cortexSubcat = output.subcategories.find(
            (s: { path: string }) => s.path === 'project/cortex',
        );
        expect(cortexSubcat).toBeDefined();
        expect(cortexSubcat.description).toBe('Cortex memory system');

        const otherSubcat = output.subcategories.find(
            (s: { path: string }) => s.path === 'project/other',
        );
        expect(otherSubcat).toBeDefined();
        expect(otherSubcat.description).toBeUndefined();
    });

    it('should include updated_at field in memory entries', async () => {
        const input: ListMemoriesInput = {
            store: 'global',
            category: 'project',
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.memories).toBeDefined();
        expect(output.memories.length).toBeGreaterThan(0);

        for (const memory of output.memories) {
            expect(memory).toHaveProperty('updated_at');
            if (memory.updated_at !== undefined) {
                expect(typeof memory.updated_at).toBe('string');
                expect(() => new Date(memory.updated_at)).not.toThrow();
            }
        }
    });
});

// =============================================================================
// Unit tests — mock-based, no filesystem
// =============================================================================

describe('listMemoriesHandler (unit)', () => {
    it('should throw McpError(InvalidParams) when store resolution fails', async () => {
        const ctx = createMockCortexContext({
            cortex: createMockCortex({
                getStore: mock(() => err({ code: 'STORE_NOT_FOUND', message: 'Store not found' }) as any),
            }) as any,
        });

        await expectMcpInvalidParams(() =>
            listMemoriesHandler(ctx, { store: 'missing' }),
        );
    });

    it('should throw McpError(InvalidParams) when store.root() fails', async () => {
        const storeClient = createMockStoreClient({
            root: mock(() => err({ code: 'STORAGE_ERROR', message: 'Root unavailable' }) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInvalidParams(() =>
            listMemoriesHandler(ctx, { store: 'global' }),
        );
    });

    it('should throw McpError(InvalidParams) when category is not found', async () => {
        const rootCategory = createMockCategoryClient({
            getCategory: mock(() => err({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' }) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        await expectMcpInvalidParams(() =>
            listMemoriesHandler(ctx, { store: 'global', category: 'nonexistent' }),
        );
    });

    it('should return all memories with category=all when no category is specified', async () => {
        const rootCategory = createMockCategoryClient({
            listMemories: mock(async () => ok([
                {
                    path: { toString: () => 'project/mem1', slug: { toString: () => 'mem1' } },
                    tokenEstimate: 120,
                    updatedAt: new Date('2024-06-01'),
                },
                {
                    path: { toString: () => 'project/mem2', slug: { toString: () => 'mem2' } },
                    tokenEstimate: 80,
                    updatedAt: new Date('2024-06-02'),
                },
            ]) as any),
            listSubcategories: mock(async () => ok([]) as any),
            getMemory: mock(() => createMockMemoryClient()),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await listMemoriesHandler(ctx, { store: 'global', includeExpired: true });
        const output = parseResponseJson(result) as any;

        expect(output.category).toBe('all');
        expect(output.count).toBe(2);
        expect(Array.isArray(output.memories)).toBe(true);
        expect(output.memories).toHaveLength(2);
        expect(Array.isArray(output.subcategories)).toBe(true);
    });

    it('should return count=0 and empty memories array for an empty store', async () => {
        const rootCategory = createMockCategoryClient({
            listMemories: mock(async () => ok([]) as any),
            listSubcategories: mock(async () => ok([]) as any),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await listMemoriesHandler(ctx, { store: 'global', includeExpired: true });
        const output = parseResponseJson(result) as any;

        expect(output.count).toBe(0);
        expect(output.memories).toEqual([]);
    });

    it('should skip expired memories when includeExpired=false', async () => {
        const expiredMemory = {
            path: 'project/old',
            content: '',
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: [],
                source: 'mcp' as const,
                citations: [],
                expiresAt: new Date(0),
            },
            isExpired: () => true,
        };
        const activeMemory = {
            path: 'project/active',
            content: '',
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: [],
                source: 'mcp' as const,
                citations: [],
                expiresAt: undefined,
            },
            isExpired: () => false,
        };

        const expiredMemClient = createMockMemoryClient({
            get: mock(async () => ok(expiredMemory)),
        });
        const activeMemClient = createMockMemoryClient({
            get: mock(async () => ok(activeMemory)),
        });

        let callIndex = 0;
        const rootCategory = createMockCategoryClient({
            listMemories: mock(async () => ok([
                {
                    path: { toString: () => 'project/old', slug: { toString: () => 'old' } },
                    tokenEstimate: 50,
                    updatedAt: new Date(),
                },
                {
                    path: { toString: () => 'project/active', slug: { toString: () => 'active' } },
                    tokenEstimate: 60,
                    updatedAt: new Date(),
                },
            ]) as any),
            listSubcategories: mock(async () => ok([]) as any),
            getMemory: mock(() => {
                // Return expired client for first call, active client for second
                return callIndex++ === 0 ? expiredMemClient : activeMemClient;
            }),
        });
        const storeClient = createMockStoreClient({
            root: mock(() => ok(rootCategory) as any),
        });
        const ctx = createMockCortexContext({
            cortex: createMockCortex({ getStore: mock(() => ok(storeClient) as any) }) as any,
        });

        const result = await listMemoriesHandler(ctx, { store: 'global', includeExpired: false });
        const output = parseResponseJson(result) as any;

        // Only the active memory should appear
        expect(output.count).toBe(1);
        expect(output.memories).toHaveLength(1);
        expect(output.memories[0].path).toBe('project/active');
    });
});
