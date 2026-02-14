/**
 * Tests for updateMemory operation.
 * @module core/memory/operations/update.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/adapter.ts';
import { updateMemory } from './update.ts';
import {
    ok,
    err,
    createMockStorage,
    sampleMemory,
    expiredMemory,
} from './test-helpers.spec.ts';

describe('updateMemory', () => {
    it('should update content only', async () => {
        let _writtenContent: string | undefined;
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
                write: async (memory) => {
                    _writtenContent = memory.content;
                    return ok(undefined);
                },
            },
        });
        const result = await updateMemory(storage,  'project/test/memory', {
            content: 'Updated content',
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.content).toBe('Updated content');
            // Original tags preserved
            expect(result.value.metadata.tags).toEqual([
                'test', 'sample',
            ]);
        }
    });

    it('should update tags only', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            tags: [
                'new', 'tags',
            ],
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.tags).toEqual([
                'new', 'tags',
            ]);
            // Original content preserved
            expect(result.value.content).toContain('Sample memory content');
        }
    });

    it('should update expiration date', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
            },
        });
        const newExpiry = new Date('2030-12-31T00:00:00Z');
        const result = await updateMemory(storage,  'project/test/memory', {
            expiresAt: newExpiry,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.expiresAt?.toISOString()).toBe('2030-12-31T00:00:00.000Z');
        }
    });

    it('should clear expiry with expiresAt=null', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(expiredMemory),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            expiresAt: null,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.expiresAt).toBeUndefined();
        }
    });

    it('should preserve existing expiry when expiresAt is omitted', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(expiredMemory),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated content only',
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.expiresAt).toBeDefined();
        }
    });

    it('should update multiple fields at once', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'New content',
            tags: ['updated'],
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.content).toBe('New content');
            expect(result.value.metadata.tags).toEqual(['updated']);
        }
    });

    it('should preserve createdAt and update updatedAt', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
            },
        });
        const updateTime = new Date('2025-06-20T10:00:00Z');
        const result = await updateMemory(
            storage,
            'project/test/memory',
            { content: 'Updated' },
            updateTime,
        );
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.createdAt.toISOString()).toBe('2025-01-15T12:00:00.000Z');
            expect(result.value.metadata.updatedAt.toISOString()).toBe('2025-06-20T10:00:00.000Z');
        }
    });

    it('should return INVALID_INPUT when no updates provided', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {});
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_INPUT');
        }
    });

    it('should return MEMORY_NOT_FOUND when missing', async () => {
        const storage = createMockStorage();
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        }
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await updateMemory(storage, 'x', { content: 'Updated' });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when read fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () =>
                    err({ code: 'IO_READ_ERROR', message: 'IO error' } as StorageAdapterError),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when write fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemory),
                write: async () =>
                    err({ code: 'IO_WRITE_ERROR', message: 'Disk full' } as StorageAdapterError),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});

