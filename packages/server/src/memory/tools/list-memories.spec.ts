/**
 * Unit tests for cortex_list_memories tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { listMemoriesHandler, type ListMemoriesInput } from './list-memories.ts';
import { CategoryPath } from '@yeseh/cortex-core';

const categoryPath = (path: string): CategoryPath => CategoryPath.fromString(path).unwrap();

describe('cortex_list_memories tool', () => {
    let testDir: string;
    let ctx: ToolContext;

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
            store: 'default',
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
            store: 'default',
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
            store: 'default',
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
            store: 'default',
            category: 'project',
            include_expired: true,
        };

        const result = await listMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(3);
    });

    it('should include subcategory descriptions in response', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

        await adapter.indexes.write(categoryPath('project'), {
            memories: [],
            subcategories: [
                { path: categoryPath('project/cortex'), memoryCount: 0, description: 'Cortex memory system' },
                { path: categoryPath('project/other'), memoryCount: 0 },
            ],
        });

        const input: ListMemoriesInput = {
            store: 'default',
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
            store: 'default',
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
