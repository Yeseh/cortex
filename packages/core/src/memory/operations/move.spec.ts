/**
 * Tests for moveMemory operation.
 * @module core/memory/operations/move.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/adapter.ts';
import { Memory } from '@/memory';
import type { MemoryPath } from '@/memory/memory-path.ts';
import { moveMemory } from './move.ts';
import { ok, err, createMockStorage } from './test-helpers.spec.ts';

const buildMemory = (path: string): Memory => {
    const now = new Date('2025-01-15T12:00:00.000Z');
    const result = Memory.init(
        path,
        {
            createdAt: now,
            updatedAt: now,
            tags: [],
            source: 'test',
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

describe('moveMemory', () => {
    it('should move memory successfully', async () => {
        let movedFrom: string | undefined;
        let movedTo: string | undefined;

        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    pathToString(path) === 'project/src/memory'
                        ? ok(buildMemory('project/src/memory'))
                        : ok(null),
                move: async (from, to) => {
                    movedFrom = pathToString(from);
                    movedTo = pathToString(to);
                    return ok(undefined);
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(true);
        expect(movedFrom).toBe('project/src/memory');
        expect(movedTo).toBe('project/dest/memory');
    });

    it('should return ok for same-path move (no-op)', async () => {
        let moveCalled = false;
        const storage = createMockStorage({
            memories: {
                move: async () => {
                    moveCalled = true;
                    return ok(undefined);
                },
            },
        });
        const result = await moveMemory(storage, 'project/test/memory', 'project/test/memory');
        expect(result.ok()).toBe(true);
        expect(moveCalled).toBe(false); // Move should not be called for same path
    });

    it('should return MEMORY_NOT_FOUND for missing source', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            expect(result.error.path).toBe('project/src/memory');
        }
    });

    it('should return DESTINATION_EXISTS for existing destination', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(buildMemory('project/src/memory')), // Both source and dest exist
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('DESTINATION_EXISTS');
            expect(result.error.path).toBe('project/dest/memory');
        }
    });

    it('should return INVALID_PATH for invalid source path', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'invalid', 'project/dest/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return INVALID_PATH for invalid destination path', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'project/src/memory', 'x');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should ensure destination category exists', async () => {
        let ensuredCategory: string | undefined;
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    pathToString(path) === 'project/src/memory'
                        ? ok(buildMemory('project/src/memory'))
                        : ok(null),
            },
            categories: {
                ensure: async (path) => {
                    ensuredCategory = path.toString();
                    return ok(undefined);
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(true);
        expect(ensuredCategory).toBe('project/dest');
    });

    it('should reindex after successful move', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    pathToString(path) === 'project/src/memory'
                        ? ok(buildMemory('project/src/memory'))
                        : ok(null),
            },
            indexes: {
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should return STORAGE_ERROR when move fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    pathToString(path) === 'project/src/memory'
                        ? ok(buildMemory('project/src/memory'))
                        : ok(null),
                move: async () =>
                    err({ code: 'IO_WRITE_ERROR', message: 'Move failed' } as StorageAdapterError),
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when reindex fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    pathToString(path) === 'project/src/memory'
                        ? ok(buildMemory('project/src/memory'))
                        : ok(null),
            },
            indexes: {
                reindex: async () =>
                    err({
                        code: 'INDEX_ERROR',
                        message: 'Reindex failed',
                    } as StorageAdapterError),
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});
