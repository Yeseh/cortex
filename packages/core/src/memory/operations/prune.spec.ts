/**
 * Tests for pruneExpiredMemories operation.
 * @module core/memory/operations/prune.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/adapter.ts';
import type { MemoryPath } from '@/memory/memory-path.ts';
import { pruneExpiredMemories } from './prune.ts';
import {
    ok,
    err,
    buildIndex,
    createMockStorage,
    buildMemoryFixture,
    memoryWithExpiry,
} from './test-helpers.spec.ts';

const pathToString = (memoryPath: MemoryPath): string =>
    `${memoryPath.category.toString()}/${memoryPath.slug.toString()}`;

const expiredAt = new Date('2025-01-10T12:00:00.000Z');

describe('pruneExpiredMemories', () => {
    it('should return empty list when no expired memories', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') {
                        // Root index with no subcategories
                        return ok(buildIndex([], []));
                    }
                    return ok(null);
                },
            },
        });
        const result = await pruneExpiredMemories(storage);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.pruned).toEqual([]);
        }
    });

    it('should return candidates without deleting in dry run mode', async () => {
        const rootIndex = buildIndex([], [{ path: 'project', memoryCount: 1 }]);
        const projectIndex = buildIndex([], [{ path: 'project/test', memoryCount: 1 }]);
        const testIndex = buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], []);

        let deleteCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') return ok(projectIndex);
                    if (path === 'project/test') return ok(testIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
                remove: async () => {
                    deleteCalled = true;
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { dryRun: true, now });
        expect(result.ok()).toBe(true);
        expect(deleteCalled).toBe(false);
        if (result.ok() && result.value.pruned.length > 0) {
            expect(result.value.pruned[0]?.path).toBe('project/test/expired');
        }
    });

    it('should delete expired memories when not in dry run mode', async () => {
        const rootIndex = buildIndex([], [{ path: 'project', memoryCount: 1 }]);
        const projectIndex = buildIndex([], [{ path: 'project/test', memoryCount: 1 }]);
        const testIndex = buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], []);

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') return ok(projectIndex);
                    if (path === 'project/test') return ok(testIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
                remove: async (path) => {
                    deletedPaths.push(pathToString(path));
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.pruned.length).toBe(1);
            expect(deletedPaths).toContain('project/test/expired');
        }
    });

    it('should reindex after pruning when memories were deleted', async () => {
        const rootIndex = buildIndex([], [{ path: 'project', memoryCount: 1 }]);
        const projectIndex = buildIndex([], [{ path: 'project/test', memoryCount: 1 }]);
        const testIndex = buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], []);

        let reindexCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') return ok(projectIndex);
                    if (path === 'project/test') return ok(testIndex);
                    return ok(null);
                },
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should not reindex when no memories were pruned', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') {
                        // Root index with no subcategories
                        return ok(buildIndex([], []));
                    }
                    return ok(null);
                },
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });

        const result = await pruneExpiredMemories(storage);
        expect(result.ok()).toBe(true);
        expect(reindexCalled).toBe(false);
    });

    it('should return STORAGE_ERROR when delete fails', async () => {
        const rootIndex = buildIndex([], [{ path: 'project', memoryCount: 1 }]);
        const projectIndex = buildIndex([], [{ path: 'project/test', memoryCount: 1 }]);
        const testIndex = buildIndex([{ path: 'project/test/expired', tokenEstimate: 100 }], []);

        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') return ok(projectIndex);
                    if (path === 'project/test') return ok(testIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
                remove: async () =>
                    err({
                        code: 'IO_WRITE_ERROR',
                        message: 'Delete failed',
                    } as StorageAdapterError),
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should skip non-expired memories', async () => {
        const rootIndex = buildIndex([], [{ path: 'project', memoryCount: 1 }]);
        const projectIndex = buildIndex([{ path: 'project/test/active', tokenEstimate: 100 }], []);

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') return ok(projectIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async () => ok(memoryWithExpiry), // Not expired
                remove: async (path) => {
                    deletedPaths.push(pathToString(path));
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.pruned).toEqual([]);
            expect(deletedPaths).toEqual([]);
        }
    });

    it('should prune across multiple root categories', async () => {
        const rootIndex = buildIndex(
            [],
            [
                { path: 'project', memoryCount: 1 },
                { path: 'human', memoryCount: 1 },
            ]
        );

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'project') {
                        return ok(
                            buildIndex([{ path: 'project/expired1', tokenEstimate: 100 }], [])
                        );
                    }
                    if (path === 'human') {
                        return ok(buildIndex([{ path: 'human/expired2', tokenEstimate: 50 }], []));
                    }
                    return ok(null);
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
                remove: async (path) => {
                    deletedPaths.push(pathToString(path));
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.pruned.length).toBe(2);
            expect(deletedPaths).toContain('project/expired1');
            expect(deletedPaths).toContain('human/expired2');
        }
    });

    it('should prune memories in non-standard root categories', async () => {
        // Test that dynamic discovery finds memories in any root category, not just human/persona
        const rootIndex = buildIndex(
            [],
            [
                { path: 'todo', memoryCount: 1 },
                { path: 'issues', memoryCount: 1 },
            ]
        );

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path: string) => {
                    if (path === '') return ok(rootIndex);
                    if (path === 'todo') {
                        return ok(
                            buildIndex([{ path: 'todo/expired-task', tokenEstimate: 50 }], [])
                        );
                    }
                    if (path === 'issues') {
                        return ok(
                            buildIndex([{ path: 'issues/old-issue', tokenEstimate: 75 }], [])
                        );
                    }
                    return ok(null);
                },
            },
            memories: {
                read: async (path) =>
                    ok(
                        buildMemoryFixture(
                            pathToString(path),
                            { expiresAt: expiredAt },
                            'Expired content'
                        )
                    ),
                remove: async (path) => {
                    deletedPaths.push(pathToString(path));
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.pruned.length).toBe(2);
            expect(deletedPaths).toContain('todo/expired-task');
            expect(deletedPaths).toContain('issues/old-issue');
        }
    });
});
