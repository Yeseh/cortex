/**
 * Tests for createMemory operation.
 * @module core/memory/operations/create.spec
 */

import { describe, it, expect } from 'bun:test';
import type { StorageAdapterError } from '@/storage/adapter.ts';
import type { Memory } from '@/memory';
import { createMemory } from './create.ts';
import {  createMockStorage } from './test-helpers.spec.ts';
import { err, ok } from '@/result.ts';

describe('createMemory', () => {
    it('should create a memory with all fields', async () => {
        let writtenMemory: Memory | undefined;
        let indexedMemory: Memory | undefined;

        const storage = createMockStorage({
            memories: {
                write: async (memory) => {
                    writtenMemory = memory;
                    return ok(undefined);
                },
            },
            indexes: {
                updateAfterMemoryWrite: async (memory) => {
                    indexedMemory = memory;
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2024-06-15T10:30:00.000Z');
        const expiresAt = new Date('2030-06-01T00:00:00Z');
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            tags: [
                'tag1', 'tag2',
            ],
            source: 'test',
            expiresAt,
            citations: ['docs/spec.md'],
        }, now);

        expect(result.ok()).toBe(true);
        expect(writtenMemory).toBeDefined();
        expect(indexedMemory).toBeDefined();
        if (writtenMemory && indexedMemory) {
            expect(writtenMemory).toBe(indexedMemory);
            expect(writtenMemory.path.category.toString()).toBe('project/test');
            expect(writtenMemory.path.slug.toString()).toBe('memory');
            expect(writtenMemory.content).toBe('Test content');
            expect(writtenMemory.metadata.tags).toEqual([
                'tag1', 'tag2',
            ]);
            expect(writtenMemory.metadata.source).toBe('test');
            expect(writtenMemory.metadata.expiresAt).toEqual(expiresAt);
            expect(writtenMemory.metadata.citations).toEqual(['docs/spec.md']);
            expect(writtenMemory.metadata.createdAt).toEqual(now);
            expect(writtenMemory.metadata.updatedAt).toEqual(now);
        }
    });

    it('should create a memory with minimal fields', async () => {
        let writtenMemory: Memory | undefined;
        const storage = createMockStorage({
            memories: {
                write: async (memory) => {
                    writtenMemory = memory;
                    return ok(undefined);
                },
            },
        });
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok()).toBe(true);
        expect(writtenMemory).toBeDefined();
        if (writtenMemory) {
            expect(writtenMemory.metadata.tags).toEqual([]);
            expect(writtenMemory.metadata.citations).toEqual([]);
        }
    });

    it('should create a memory with expiration', async () => {
        let writtenMemory: Memory | undefined;
        const storage = createMockStorage({
            memories: {
                write: async (memory) => {
                    writtenMemory = memory;
                    return ok(undefined);
                },
            },
        });

        const expiresAt = new Date('2030-06-01T00:00:00Z');
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Expiring content',
            source: 'test',
            expiresAt,
        });

        expect(result.ok()).toBe(true);
        expect(writtenMemory?.metadata.expiresAt).toEqual(expiresAt);
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, 'invalid', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return INVALID_PATH for empty path', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, '', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when write fails', async () => {
        const storage = createMockStorage({
            memories: {
                write: async () =>
                    err({ code: 'IO_WRITE_ERROR', message: 'Disk full' } as StorageAdapterError),
            },
        });
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when index update fails', async () => {
        const storage = createMockStorage({
            indexes: {
                updateAfterMemoryWrite: async () =>
                    err({
                        code: 'INDEX_ERROR',
                        message: 'Index error',
                    } as StorageAdapterError),
            },
        });
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORAGE_ERROR');
            expect(result.error.message).toContain('project/test/memory');
            expect(result.error.message).toContain('Index error');
            expect(result.error.message).toContain('cortex store reindex');
            expect(result.error.path).toBe('project/test/memory');
        }
    });

    it('should use provided timestamp when now parameter is given', async () => {
        let writtenMemory: Memory | undefined;
        const storage = createMockStorage({
            memories: {
                write: async (memory) => {
                    writtenMemory = memory;
                    return ok(undefined);
                },
            },
        });

        const customTime = new Date('2024-06-15T10:30:00.000Z');
        const result = await createMemory(
            storage,
            'project/test/memory',
            { content: 'Test', source: 'test' },
            customTime,
        );

        expect(result.ok()).toBe(true);
        expect(writtenMemory?.metadata.createdAt).toEqual(customTime);
        expect(writtenMemory?.metadata.updatedAt).toEqual(customTime);
    });

    it('should return the created Memory object', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toBeDefined();
            expect(result.value.path.toString()).toBe('project/test/memory');
            expect(result.value.content).toBe('Test content');
        }
    });

    it('should return Memory with normalized path when input has double slashes', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, 'project//test//memory', {
            content: 'Test content',
            source: 'test',
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            // Path should be normalized - double slashes removed
            expect(result.value.path.toString()).toBe('project/test/memory');
        }
    });

    it('should return CATEGORY_NOT_FOUND when category does not exist', async () => {
        const adapter = createMockStorage({
            categories: { exists: async () => ok(false) },
        });

        const result = await createMemory(adapter, 'missing-category/memory', {
            content: 'Test content',
            source: 'test',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
            expect(result.error.message).toContain('missing-category');
            expect(result.error.message).toContain('Create it first');
        }
    });

    it('should return CATEGORY_NOT_FOUND when nested category does not exist', async () => {
        const adapter = createMockStorage({
            categories: { exists: async () => ok(false) },
        });

        const result = await createMemory(adapter, 'existing/missing/memory', {
            content: 'Test content',
            source: 'test',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
            expect(result.error.message).toContain('existing/missing');
        }
    });

    it('should return INVALID_PATH for memory without category', async () => {
        const adapter = createMockStorage();

        const result = await createMemory(adapter, 'just-a-memory', {
            content: 'Test content',
            source: 'test',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_PATH');
            expect(result.error.message).toContain('must include at least one category');
        }
    });
});
