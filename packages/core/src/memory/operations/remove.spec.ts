/**
 * Tests for removeMemory operation.
 * @module core/memory/operations/remove.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/index.ts';
import { removeMemory } from './remove.ts';
import { ok, err, createMockStorage, sampleMemory, memoryPathToString } from './test-helpers.spec.ts';

describe('removeMemory', () => {
    it('should remove existing memory', async () => {
        let removedPath: string | undefined;
        const storage = createMockStorage({
            memories: {
                load: async () => ok(sampleMemory),
                remove: async (path) => {
                    removedPath = memoryPathToString(path);
                    return ok(undefined);
                },
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(true);
        expect(removedPath).toBe('project/test/memory');
    });

    it('should reindex after successful remove', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            memories: {
                load: async () => ok(sampleMemory),
            },
            indexes: {
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should return MEMORY_NOT_FOUND for missing memory', async () => {
        const storage = createMockStorage();
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        }
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await removeMemory(storage, 'x');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when read fails', async () => {
        const storage = createMockStorage({
            memories: {
                load: async () =>
                    err({ code: 'IO_READ_ERROR', message: 'IO error' } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when remove fails', async () => {
        const storage = createMockStorage({
            memories: {
                load: async () => ok(sampleMemory),
                remove: async () =>
                    err({
                        code: 'IO_WRITE_ERROR',
                        message: 'Delete failed',
                    } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when reindex fails', async () => {
        const storage = createMockStorage({
            memories: {
                load: async () => ok(sampleMemory),
            },
            indexes: {
                reindex: async () =>
                    err({
                        code: 'INDEX_ERROR',
                        message: 'Reindex failed',
                    } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});
