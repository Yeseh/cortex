/**
 * Unit tests for cortex_get_recent_memories tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestContext, createTestDir } from './test-utils.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import {
    getRecentMemoriesHandler,
    getRecentMemoriesInputSchema,
    type GetRecentMemoriesInput,
} from './get-recent-memories.ts';

describe('cortex_get_recent_memories tool', () => {
    let testDir: string;
    let ctx: CortexContext;
    let memoryDir: string;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
        memoryDir = join(testDir, MEMORY_SUBDIR);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should retrieve recent memories sorted by updatedAt descending', async () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 86400000);
        const twoDaysAgo = new Date(now.getTime() - 172800000);

        await createMemoryFile(memoryDir, 'project/oldest', {
            content: 'Oldest memory',
            metadata: {
                createdAt: twoDaysAgo,
                updatedAt: twoDaysAgo,
                tags: [],
                source: 'test',
                citations: [],
            },
        });

        await createMemoryFile(memoryDir, 'project/middle', {
            content: 'Middle memory',
            metadata: {
                createdAt: oneDayAgo,
                updatedAt: oneDayAgo,
                tags: ['tag1'],
                source: 'test',
                citations: [],
            },
        });

        await createMemoryFile(memoryDir, 'project/newest', {
            content: 'Newest memory',
            metadata: {
                createdAt: now,
                updatedAt: now,
                tags: [
                    'tag2', 'tag3',
                ],
                source: 'test',
                citations: [],
            },
        });

        const input: GetRecentMemoriesInput = {
            store: 'default',
            limit: 10,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('all');
        expect(output.count).toBe(3);
        expect(output.memories).toHaveLength(3);

        expect(output.memories[0]!.path).toBe('project/newest');
        expect(output.memories[0]!.content).toBe('Newest memory');
        expect(output.memories[0]!.tags).toEqual([
            'tag2', 'tag3',
        ]);
        expect(output.memories[0]!.token_estimate).toBeGreaterThan(0);
        expect(output.memories[0]!.updated_at).toBeDefined();

        expect(output.memories[1]!.path).toBe('project/middle');
        expect(output.memories[1]!.content).toBe('Middle memory');
        expect(output.memories[1]!.tags).toEqual(['tag1']);

        expect(output.memories[2]!.path).toBe('project/oldest');
        expect(output.memories[2]!.content).toBe('Oldest memory');
        expect(output.memories[2]!.tags).toEqual([]);
    });

    it('should limit results to specified limit', async () => {
        const now = new Date();
        for (let i = 0; i < 5; i++) {
            const timestamp = new Date(now.getTime() - i * 1000);
            await createMemoryFile(memoryDir, `project/memory-${i}`, {
                content: `Memory ${i}`,
                metadata: {
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    tags: [],
                    source: 'test',
                    citations: [],
                },
            });
        }

        const input: GetRecentMemoriesInput = {
            store: 'default',
            limit: 3,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(3);
        expect(output.memories).toHaveLength(3);

        expect(output.memories[0]!.path).toBe('project/memory-0');
        expect(output.memories[1]!.path).toBe('project/memory-1');
        expect(output.memories[2]!.path).toBe('project/memory-2');
    });

    it('should scope to specific category when provided', async () => {
        const now = new Date();

        await createMemoryFile(memoryDir, 'project/cortex/memory1', {
            content: 'Cortex memory 1',
            metadata: {
                createdAt: now,
                updatedAt: now,
                tags: [],
                source: 'test',
                citations: [],
            },
        });

        await createMemoryFile(memoryDir, 'project/other/memory2', {
            content: 'Other memory 2',
            metadata: {
                createdAt: now,
                updatedAt: now,
                tags: [],
                source: 'test',
                citations: [],
            },
        });

        const input: GetRecentMemoriesInput = {
            store: 'default',
            category: 'project/cortex',
            limit: 10,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('project/cortex');
        expect(output.count).toBe(1);
        expect(output.memories).toHaveLength(1);
        expect(output.memories[0]!.path).toBe('project/cortex/memory1');
        expect(output.memories[0]!.content).toBe('Cortex memory 1');
    });

    it('should exclude expired memories by default', async () => {
        const now = new Date();
        const pastDate = new Date(now.getTime() - 86400000);

        await createMemoryFile(memoryDir, 'project/active', {
            content: 'Active memory',
            metadata: {
                createdAt: now,
                updatedAt: now,
                tags: [],
                source: 'test',
                citations: [],
            },
        });

        await createMemoryFile(memoryDir, 'project/expired', {
            content: 'Expired memory',
            metadata: {
                createdAt: pastDate,
                updatedAt: pastDate,
                tags: [],
                source: 'test',
                citations: [],
                expiresAt: pastDate,
            },
        });

        const input: GetRecentMemoriesInput = {
            store: 'default',
            limit: 10,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(1);
        expect(output.memories).toHaveLength(1);
        expect(output.memories[0]!.path).toBe('project/active');
    });

    it('should include expired memories when include_expired is true', async () => {
        const now = new Date();
        const pastDate = new Date(now.getTime() - 86400000);

        await createMemoryFile(memoryDir, 'project/active', {
            content: 'Active memory',
            metadata: {
                createdAt: now,
                updatedAt: now,
                tags: [],
                source: 'test',
                citations: [],
            },
        });

        await createMemoryFile(memoryDir, 'project/expired', {
            content: 'Expired memory',
            metadata: {
                createdAt: pastDate,
                updatedAt: pastDate,
                tags: [],
                source: 'test',
                citations: [],
                expiresAt: pastDate,
            },
        });

        const input: GetRecentMemoriesInput = {
            store: 'default',
            limit: 10,
            include_expired: true,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(2);
        expect(output.memories).toHaveLength(2);
        expect(output.memories[0]!.path).toBe('project/active');
        expect(output.memories[1]!.path).toBe('project/expired');
    });

    it('should return empty array when no memories exist', async () => {
        const input: GetRecentMemoriesInput = {
            store: 'default',
            limit: 10,
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('all');
        expect(output.count).toBe(0);
        expect(output.memories).toEqual([]);
    });

    it('should use default limit of 5 when not specified', async () => {
        const now = new Date();
        for (let i = 0; i < 10; i++) {
            const timestamp = new Date(now.getTime() - i * 1000);
            await createMemoryFile(memoryDir, `project/memory-${i}`, {
                content: `Memory ${i}`,
                metadata: {
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    tags: [],
                    source: 'test',
                    citations: [],
                },
            });
        }

        const input: GetRecentMemoriesInput = {
            store: 'default',
        };

        const result = await getRecentMemoriesHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.count).toBe(5);
        expect(output.memories).toHaveLength(5);
    });

    it('should reject invalid store', async () => {
        const input: GetRecentMemoriesInput = {
            store: 'nonexistent-store',
            limit: 10,
        };

        await expect(getRecentMemoriesHandler(ctx, input)).rejects.toThrow();
    });

    it('should validate limit parameter bounds', () => {
        const tooLow = { store: 'default', limit: 0 };
        expect(getRecentMemoriesInputSchema.safeParse(tooLow).success).toBe(false);

        const tooHigh = { store: 'default', limit: 101 };
        expect(getRecentMemoriesInputSchema.safeParse(tooHigh).success).toBe(false);

        const valid = { store: 'default', limit: 50 };
        expect(getRecentMemoriesInputSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject get_recent_memories without store parameter', () => {
        const input = { limit: 10 };
        const result = getRecentMemoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });
});
