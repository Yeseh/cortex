/**
 * Tests for getMemory operation.
 * @module core/memory/operations/get.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/adapter.ts';
import { Memory } from '@/memory';
import { getMemory } from './get.ts';
import { createMockStorage } from './test-helpers.spec.ts';
import { err, ok } from '@/result.ts';

const buildMemory = (path: string, overrides?: Partial<Memory['metadata']>): Memory => {
    const now = new Date('2025-01-15T12:00:00.000Z');
    const metadata = {
        createdAt: now,
        updatedAt: now,
        tags: [
            'test', 'sample',
        ],
        source: 'test',
        expiresAt: undefined,
        citations: [],
        ...overrides,
    };
    const result = Memory.init(path, metadata, 'Sample memory content');
    if (!result.ok()) {
        throw new Error('Test setup failed to create memory.');
    }
    return result.value;
};

describe('getMemory', () => {
    it('should return memory when found', async () => {
        const memory = buildMemory('project/test/memory');
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memory),
            },
        });
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.content).toContain('Sample memory content');
            expect(result.value.metadata.tags).toEqual([
                'test', 'sample',
            ]);
            expect(result.value.metadata.source).toBe('test');
        }
    });

    it('should return MEMORY_NOT_FOUND when missing', async () => {
        const storage = createMockStorage();
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            expect(result.error.path).toBe('project/test/memory');
        }
    });

    it('should return MEMORY_EXPIRED when expired and includeExpired=false', async () => {
        const memory = buildMemory('project/test/memory', {
            expiresAt: new Date('2025-01-10T12:00:00.000Z'),
        });
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memory),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z'); // After expiration (2025-01-10)
        const result = await getMemory(storage, 'project/test/memory', { now });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MEMORY_EXPIRED');
        }
    });

    it('should return expired memory when includeExpired=true', async () => {
        const memory = buildMemory('project/test/memory', {
            expiresAt: new Date('2025-01-10T12:00:00.000Z'),
        });
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memory),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await getMemory(storage, 'project/test/memory', {
            includeExpired: true,
            now,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.content).toContain('Sample memory content');
        }
    });

    it('should return non-expired memory normally', async () => {
        const memory = buildMemory('project/test/memory', {
            expiresAt: new Date('2030-01-01T12:00:00.000Z'),
        });
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memory),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z'); // Before expiration (2030-01-01)
        const result = await getMemory(storage, 'project/test/memory', { now });
        expect(result.ok()).toBe(true);
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await getMemory(storage, 'invalid');
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
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should handle memory without expiration', async () => {
        const memory = buildMemory('project/test/memory');
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memory),
            },
        });
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.expiresAt).toBeUndefined();
        }
    });
});
