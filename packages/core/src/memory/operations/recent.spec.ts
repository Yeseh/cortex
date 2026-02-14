/**
 * Tests for getRecentMemories operation.
 * @module core/memory/operations/recent.spec
 */

import { describe, it, expect } from 'bun:test';
import type { Memory } from '@/memory/memory.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';
import { getRecentMemories } from './recent.ts';
import { ok, buildIndex, buildMemoryFixture, createMockStorage } from './test-helpers.spec.ts';

const pathToString = (memoryPath: MemoryPath): string => (
    `${memoryPath.category.toString()}/${memoryPath.slug.toString()}`
);

const buildRecentMemory = (
    path: string,
    updatedAt: Date,
    tags: string[],
    content: string,
    expiresAt?: Date,
): Memory => buildMemoryFixture(
    path,
    {
        createdAt: new Date('2025-01-01T10:00:00.000Z'),
        updatedAt,
        tags,
        expiresAt,
    },
    content,
);

describe('getRecentMemories', () => {
    it('should retrieve recent memories store-wide sorted by updatedAt', async () => {
        const memoryFiles: Record<string, Memory> = {
            'project/memory1': buildRecentMemory(
                'project/memory1',
                new Date('2025-01-03T10:00:00.000Z'),
                ['project'],
                'Memory 1 content',
            ),
            'project/memory2': buildRecentMemory(
                'project/memory2',
                new Date('2025-01-05T10:00:00.000Z'),
                ['project'],
                'Memory 2 content',
            ),
            'notes/note1': buildRecentMemory(
                'notes/note1',
                new Date('2025-01-04T10:00:00.000Z'),
                ['notes'],
                'Note 1 content',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(
                            buildIndex(
                                [],
                                [
                                    { path: 'project', memoryCount: 2 },
                                    { path: 'notes', memoryCount: 1 },
                                ],
                            ),
                        );
                    }
                    if (name === 'project') {
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'project/memory1',
                                        tokenEstimate: 50,
                                        updatedAt: new Date('2025-01-03T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'project/memory2',
                                        tokenEstimate: 60,
                                        updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    if (name === 'notes') {
                        return ok(
                            buildIndex(
                                [{
                                    path: 'notes/note1',
                                    tokenEstimate: 40,
                                    updatedAt: new Date('2025-01-04T10:00:00.000Z'),
                                }],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, { limit: 3 });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category).toBe('all');
            expect(result.value.count).toBe(3);
            expect(result.value.memories).toHaveLength(3);
            // Should be sorted by updatedAt descending
            expect(result.value.memories[0]?.path).toBe('project/memory2');
            expect(result.value.memories[1]?.path).toBe('notes/note1');
            expect(result.value.memories[2]?.path).toBe('project/memory1');
            // Check content is present
            expect(result.value.memories[0]?.content).toContain('Memory 2 content');
        }
    });

    it('should retrieve recent memories from a specific category', async () => {
        const memoryFiles: Record<string, Memory> = {
            'project/cortex/memory1': buildRecentMemory(
                'project/cortex/memory1',
                new Date('2025-01-03T10:00:00.000Z'),
                ['cortex'],
                'Cortex memory 1',
            ),
            'project/cortex/memory2': buildRecentMemory(
                'project/cortex/memory2',
                new Date('2025-01-05T10:00:00.000Z'),
                ['cortex'],
                'Cortex memory 2',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === 'project/cortex') {
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'project/cortex/memory1',
                                        tokenEstimate: 50,
                                        updatedAt: new Date('2025-01-03T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'project/cortex/memory2',
                                        tokenEstimate: 60,
                                        updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, {
            category: 'project/cortex',
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category).toBe('project/cortex');
            expect(result.value.count).toBe(2);
            expect(result.value.memories[0]?.path).toBe('project/cortex/memory2');
            expect(result.value.memories[1]?.path).toBe('project/cortex/memory1');
        }
    });

    it('should respect custom limit', async () => {
        const memoryFiles: Record<string, Memory> = {
            'notes/note1': buildRecentMemory(
                'notes/note1',
                new Date('2025-01-01T10:00:00.000Z'),
                [],
                'Note 1',
            ),
            'notes/note2': buildRecentMemory(
                'notes/note2',
                new Date('2025-01-02T10:00:00.000Z'),
                [],
                'Note 2',
            ),
            'notes/note3': buildRecentMemory(
                'notes/note3',
                new Date('2025-01-03T10:00:00.000Z'),
                [],
                'Note 3',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(buildIndex([], [{ path: 'notes', memoryCount: 3 }]));
                    }
                    if (name === 'notes') {
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'notes/note1',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-01T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'notes/note2',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-02T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'notes/note3',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-03T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, { limit: 2 });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(2);
            expect(result.value.memories).toHaveLength(2);
            expect(result.value.memories[0]?.path).toBe('notes/note3');
            expect(result.value.memories[1]?.path).toBe('notes/note2');
        }
    });

    it('should handle fewer memories than limit', async () => {
        const memoryFiles: Record<string, Memory> = {
            'notes/note1': buildRecentMemory(
                'notes/note1',
                new Date('2025-01-01T10:00:00.000Z'),
                [],
                'Note 1',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(buildIndex([], [{ path: 'notes', memoryCount: 1 }]));
                    }
                    if (name === 'notes') {
                        return ok(
                            buildIndex(
                                [{
                                    path: 'notes/note1',
                                    tokenEstimate: 10,
                                    updatedAt: new Date('2025-01-01T10:00:00.000Z'),
                                }],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, { limit: 10 });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(1);
            expect(result.value.memories).toHaveLength(1);
        }
    });

    it('should return empty result for empty store', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () => ok(null),
            },
        });

        const result = await getRecentMemories(storage);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category).toBe('all');
            expect(result.value.count).toBe(0);
            expect(result.value.memories).toHaveLength(0);
        }
    });

    it('should filter expired memories by default', async () => {
        const memoryFiles: Record<string, Memory> = {
            'notes/active': buildRecentMemory(
                'notes/active',
                new Date('2025-01-05T10:00:00.000Z'),
                [],
                'Active note',
            ),
            'notes/expired': buildRecentMemory(
                'notes/expired',
                new Date('2025-01-03T10:00:00.000Z'),
                [],
                'Expired note',
                new Date('2025-01-02T10:00:00.000Z'),
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(buildIndex([], [{ path: 'notes', memoryCount: 2 }]));
                    }
                    if (name === 'notes') {
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'notes/active',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'notes/expired',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-03T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const now = new Date('2025-01-10T10:00:00.000Z');
        const result = await getRecentMemories(storage, { now });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(1);
            expect(result.value.memories[0]?.path).toBe('notes/active');
        }
    });

    it('should include expired memories when requested', async () => {
        const memoryFiles: Record<string, Memory> = {
            'notes/active': buildRecentMemory(
                'notes/active',
                new Date('2025-01-05T10:00:00.000Z'),
                [],
                'Active note',
            ),
            'notes/expired': buildRecentMemory(
                'notes/expired',
                new Date('2025-01-03T10:00:00.000Z'),
                [],
                'Expired note',
                new Date('2025-01-02T10:00:00.000Z'),
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(buildIndex([], [{ path: 'notes', memoryCount: 2 }]));
                    }
                    if (name === 'notes') {
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'notes/active',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'notes/expired',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-03T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const now = new Date('2025-01-10T10:00:00.000Z');
        const result = await getRecentMemories(storage, {
            now,
            includeExpired: true,
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(2);
            expect(result.value.memories[0]?.path).toBe('notes/active');
            expect(result.value.memories[1]?.path).toBe('notes/expired');
        }
    });

    it('should sort stale index entries (missing updatedAt) last', async () => {
        const memoryFiles: Record<string, Memory> = {
            'notes/recent': buildRecentMemory(
                'notes/recent',
                new Date('2025-01-05T10:00:00.000Z'),
                [],
                'Recent note',
            ),
            'notes/stale': buildRecentMemory(
                'notes/stale',
                new Date('2025-01-03T10:00:00.000Z'),
                [],
                'Stale note',
            ),
            'notes/middle': buildRecentMemory(
                'notes/middle',
                new Date('2025-01-04T10:00:00.000Z'),
                [],
                'Middle note',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === '') {
                        return ok(buildIndex([], [{ path: 'notes', memoryCount: 3 }]));
                    }
                    if (name === 'notes') {
                        // Note: 'stale' entry is missing updated_at
                        return ok(
                            buildIndex(
                                [
                                    {
                                        path: 'notes/recent',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                    },
                                    {
                                        path: 'notes/stale',
                                        tokenEstimate: 10,
                                    },
                                    {
                                        path: 'notes/middle',
                                        tokenEstimate: 10,
                                        updatedAt: new Date('2025-01-04T10:00:00.000Z'),
                                    },
                                ],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, { limit: 10 });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(3);
            expect(result.value.memories).toHaveLength(3);
            // Stale entry (missing updatedAt) should be last
            expect(result.value.memories[0]?.path).toBe('notes/recent');
            expect(result.value.memories[1]?.path).toBe('notes/middle');
            expect(result.value.memories[2]?.path).toBe('notes/stale');
            expect(result.value.memories[2]?.updatedAt).toBe(null);
        }
    });

    it('should handle recursive category traversal', async () => {
        const memoryFiles: Record<string, Memory> = {
            'project/cortex/deep/memory1': buildRecentMemory(
                'project/cortex/deep/memory1',
                new Date('2025-01-05T10:00:00.000Z'),
                [],
                'Deep memory',
            ),
            'project/cortex/memory2': buildRecentMemory(
                'project/cortex/memory2',
                new Date('2025-01-04T10:00:00.000Z'),
                [],
                'Shallow memory',
            ),
        };

        const storage = createMockStorage({
            memories: {
                read: async (path) => ok(memoryFiles[pathToString(path)] ?? null),
            },
            indexes: {
                read: async (name: string) => {
                    if (name === 'project/cortex') {
                        return ok(
                            buildIndex(
                                [{
                                    path: 'project/cortex/memory2',
                                    tokenEstimate: 20,
                                    updatedAt: new Date('2025-01-04T10:00:00.000Z'),
                                }],
                                [{ path: 'project/cortex/deep', memoryCount: 1 }],
                            ),
                        );
                    }
                    if (name === 'project/cortex/deep') {
                        return ok(
                            buildIndex(
                                [{
                                    path: 'project/cortex/deep/memory1',
                                    tokenEstimate: 20,
                                    updatedAt: new Date('2025-01-05T10:00:00.000Z'),
                                }],
                                [],
                            ),
                        );
                    }
                    return ok(null);
                },
            },
        });

        const result = await getRecentMemories(storage, {
            category: 'project/cortex',
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.count).toBe(2);
            // Deep memory is more recent
            expect(result.value.memories[0]?.path).toBe('project/cortex/deep/memory1');
            expect(result.value.memories[1]?.path).toBe('project/cortex/memory2');
        }
    });
});

