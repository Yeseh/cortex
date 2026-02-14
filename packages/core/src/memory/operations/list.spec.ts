/**
 * Tests for listMemories operation.
 * @module core/memory/operations/list.spec
 */

import { describe, it, expect } from 'bun:test';
import { Memory } from '@/memory';
import type { MemoryPath } from '@/memory/memory-path.ts';
import { listMemories } from './list.ts';
import {
    buildIndex,
    createMockStorage,
} from './test-helpers.spec.ts';
import { ok } from '@/result.ts';

const buildMemory = (path: string, expiresAt?: Date): Memory => {
    const now = new Date('2025-01-15T12:00:00.000Z');
    const result = Memory.init(
        path,
        {
            createdAt: now,
            updatedAt: now,
            tags: [
                'test', 'sample',
            ],
            source: 'test',
            expiresAt,
            citations: [],
        },
        'Sample memory content',
    );

    if (!result.ok()) {
        throw new Error('Test setup failed to create memory.');
    }

    return result.value;
};

const pathToString = (memoryPath: MemoryPath): string => (
    `${memoryPath.category.toString()}/${memoryPath.slug.toString()}`
);

describe('listMemories', () => {
    it('should list memories in a category', async () => {
        // Index for the main category with 2 memories and 1 subcategory
        const mainIndex = buildIndex(
            [
                { path: 'project/test/memory1', tokenEstimate: 100 },
                { path: 'project/test/memory2', tokenEstimate: 150 },
            ],
            [{ path: 'project/test/sub', memoryCount: 2 }],
        );
        // Empty index for the subcategory (no recursive collection wanted for this test)
        const subIndex = buildIndex([], []);

        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === 'project/test') return ok(mainIndex);
                    if (path === 'project/test/sub') return ok(subIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async (memoryPath) => ok(buildMemory(pathToString(memoryPath))),
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category).toBe('project/test');
            expect(result.value.memories.length).toBe(2);
            expect(result.value.subcategories.length).toBe(1);
            expect(result.value.subcategories[0]?.path).toBe('project/test/sub');
        }
    });

    it('should return empty results for empty category', async () => {
        const storage = createMockStorage();
        const result = await listMemories(storage,  { category: 'project/empty' });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories).toEqual([]);
            expect(result.value.subcategories).toEqual([]);
        }
    });

    it('should filter expired memories by default', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], [])),
            },
            memories: {
                read: async () => ok(buildMemory(
                    'project/test/expired',
                    new Date('2025-01-10T12:00:00.000Z'),
                )),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, {
            category: 'project/test',
            now,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories).toEqual([]);
        }
    });

    it('should include expired memories when includeExpired=true', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], [])),
            },
            memories: {
                read: async () => ok(buildMemory(
                    'project/test/expired',
                    new Date('2025-01-10T12:00:00.000Z'),
                )),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, {
            category: 'project/test',
            includeExpired: true,
            now,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.isExpired).toBe(true);
        }
    });

    it('should list root categories when no category specified', async () => {
        const rootIndex = buildIndex(
            [],
            [
                { path: 'project', memoryCount: 0 },
                { path: 'human', memoryCount: 0 },
            ],
        );

        const storage = createMockStorage({
            indexes: {
                read: async (name: string) => {
                    if (name === '') return ok(rootIndex);
                    if (name === 'project') {
                        return ok(buildIndex([], []));
                    }
                    if (name === 'human') {
                        return ok(buildIndex([], []));
                    }
                    return ok(null);
                },
            },
        });
        const result = await listMemories(storage);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category).toBe('');
            // Should list the discovered root categories
            expect(result.value.subcategories.length).toBe(2);
            expect(result.value.subcategories.map((s) => s.path)).toContain('project');
            expect(result.value.subcategories.map((s) => s.path)).toContain('human');
        }
    });

    it('should skip entries with invalid memory paths', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(
                        buildIndex(
                            [
                                { path: 'project/test/valid', tokenEstimate: 100 },
                                { path: 'project/invalid path', tokenEstimate: 50 },
                            ],
                            [],
                        ),
                    ),
            },
            memories: {
                read: async () => ok(buildMemory('project/test/valid')),
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            // Should only include the valid memory, skipping invalid paths
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path).toBe('project/test/valid');
        }
    });

    it('should handle missing memory files gracefully', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(
                        buildIndex(
                            [
                                { path: 'project/test/exists', tokenEstimate: 100 },
                                { path: 'project/test/missing', tokenEstimate: 50 },
                            ],
                            [],
                        ),
                    ),
            },
            memories: {
                read: async (memoryPath) => {
                    const path = pathToString(memoryPath);
                    if (path === 'project/test/exists') {
                        return ok(buildMemory('project/test/exists'));
                    }
                    return ok(null);
                },
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path).toBe('project/test/exists');
        }
    });
});
