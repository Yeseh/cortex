/**
 * Tests for memory CRUD operations.
 * @module core/memory/operations.spec
 */

import { describe, it, expect } from 'bun:test';
import type { Result } from '../types.ts';
import type {
    ComposedStorageAdapter,
    MemoryStorage,
    IndexStorage,
    StoreStorage,
    StorageAdapterError,
} from '../storage/adapter.ts';
import type { CategoryStorage } from '../category/types.ts';
import type { StoreRegistry } from '../store/registry.ts';
import {
    createMemory,
    getMemory,
    updateMemory,
    moveMemory,
    removeMemory,
    listMemories,
    pruneExpiredMemories,
} from './operations.ts';

// ============================================================================
// Helper Functions
// ============================================================================

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ============================================================================
// Mock Storage Adapter Factory
// ============================================================================

const createMockStorage = (
    overrides: Partial<{
        memories: Partial<MemoryStorage>;
        indexes: Partial<IndexStorage>;
        categories: Partial<CategoryStorage>;
        stores: Partial<StoreStorage>;
    }> = {},
): ComposedStorageAdapter => ({
    memories: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
        ...overrides.memories,
    } as MemoryStorage,
    indexes: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok(undefined),
        updateAfterMemoryWrite: async () => ok(undefined),
        ...overrides.indexes,
    } as IndexStorage,
    categories: {
        categoryExists: async () => ok(false),
        readCategoryIndex: async () => ok(null),
        writeCategoryIndex: async () => ok(undefined),
        ensureCategoryDirectory: async () => ok(undefined),
        deleteCategoryDirectory: async () => ok(undefined),
        updateSubcategoryDescription: async () => ok(undefined),
        removeSubcategoryEntry: async () => ok(undefined),
        ...overrides.categories,
    } as CategoryStorage,
    stores: {
        load: async () => ok({} as StoreRegistry),
        save: async () => ok(undefined),
        remove: async () => ok(undefined),
        ...overrides.stores,
    } as StoreStorage,
});

// ============================================================================
// Sample Memory Content Fixtures
// ============================================================================

const sampleMemoryContent = `---
created_at: 2025-01-15T12:00:00.000Z
updated_at: 2025-01-15T12:00:00.000Z
tags: [test, sample]
source: test
---
Sample memory content`;

const expiredMemoryContent = `---
created_at: 2025-01-01T12:00:00.000Z
updated_at: 2025-01-01T12:00:00.000Z
tags: []
source: test
expires_at: 2025-01-10T12:00:00.000Z
---
Expired content`;

const memoryWithExpiry = `---
created_at: 2025-01-15T12:00:00.000Z
updated_at: 2025-01-15T12:00:00.000Z
tags: [active]
source: test
expires_at: 2030-01-01T12:00:00.000Z
---
Memory with future expiry`;

// ============================================================================
// createMemory Tests
// ============================================================================

describe('createMemory', () => {
    it('should create a memory with all fields', async () => {
        let writtenPath: string | undefined;
        let writtenContent: string | undefined;

        const storage = createMockStorage({
            memories: {
                write: async (path, content) => {
                    writtenPath = path;
                    writtenContent = content;
                    return ok(undefined);
                },
            },
        });

        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            tags: [
                'tag1', 'tag2',
            ],
            source: 'test',
        });

        expect(result.ok).toBe(true);
        expect(writtenPath).toBe('project/test/memory');
        expect(writtenContent).toContain('Test content');
        expect(writtenContent).toContain('source: test');
    });

    it('should create a memory with minimal fields', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok).toBe(true);
    });

    it('should create a memory with expiration', async () => {
        let writtenContent: string | undefined;
        const storage = createMockStorage({
            memories: {
                write: async (_path, content) => {
                    writtenContent = content;
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

        expect(result.ok).toBe(true);
        expect(writtenContent).toContain('expires_at: 2030-06-01T00:00:00.000Z');
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, 'invalid', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return INVALID_PATH for empty path', async () => {
        const storage = createMockStorage();
        const result = await createMemory(storage, '', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when write fails', async () => {
        const storage = createMockStorage({
            memories: {
                write: async () => err({ code: 'WRITE_FAILED', message: 'Disk full' } as StorageAdapterError),
            },
        });
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when index update fails', async () => {
        const storage = createMockStorage({
            indexes: {
                updateAfterMemoryWrite: async () =>
                    err({ code: 'INDEX_UPDATE_FAILED', message: 'Index error' } as StorageAdapterError),
            },
        });
        const result = await createMemory(storage, 'project/test/memory', {
            content: 'Test content',
            source: 'test',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should use provided timestamp when now parameter is given', async () => {
        let writtenContent: string | undefined;
        const storage = createMockStorage({
            memories: {
                write: async (_path, content) => {
                    writtenContent = content;
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

        expect(result.ok).toBe(true);
        expect(writtenContent).toContain('created_at: 2024-06-15T10:30:00.000Z');
        expect(writtenContent).toContain('updated_at: 2024-06-15T10:30:00.000Z');
    });
});

// ============================================================================
// getMemory Tests
// ============================================================================

describe('getMemory', () => {
    it('should return memory when found', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toContain('Sample memory content');
            expect(result.value.frontmatter.tags).toEqual([
                'test', 'sample',
            ]);
            expect(result.value.frontmatter.source).toBe('test');
        }
    });

    it('should return MEMORY_NOT_FOUND when missing', async () => {
        const storage = createMockStorage();
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            expect(result.error.path).toBe('project/test/memory');
        }
    });

    it('should return MEMORY_EXPIRED when expired and includeExpired=false', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z'); // After expiration (2025-01-10)
        const result = await getMemory(storage, 'project/test/memory', { now });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('MEMORY_EXPIRED');
        }
    });

    it('should return expired memory when includeExpired=true', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await getMemory(storage, 'project/test/memory', { includeExpired: true, now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toContain('Expired content');
        }
    });

    it('should return non-expired memory normally', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(memoryWithExpiry),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z'); // Before expiration (2030-01-01)
        const result = await getMemory(storage, 'project/test/memory', { now });
        expect(result.ok).toBe(true);
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await getMemory(storage, 'invalid');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when read fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => err({ code: 'READ_FAILED', message: 'IO error' } as StorageAdapterError),
            },
        });
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should handle memory without expiration', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await getMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.expiresAt).toBeUndefined();
        }
    });
});

// ============================================================================
// updateMemory Tests
// ============================================================================

describe('updateMemory', () => {
    it('should update content only', async () => {
        let _writtenContent: string | undefined;
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
                write: async (_path, content) => {
                    _writtenContent = content;
                    return ok(undefined);
                },
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated content',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toBe('Updated content');
            // Original tags preserved
            expect(result.value.frontmatter.tags).toEqual([
                'test', 'sample',
            ]);
        }
    });

    it('should update tags only', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            tags: [
                'new', 'tags',
            ],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.tags).toEqual([
                'new', 'tags',
            ]);
            // Original content preserved
            expect(result.value.content).toContain('Sample memory content');
        }
    });

    it('should update expiration date', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const newExpiry = new Date('2030-12-31T00:00:00Z');
        const result = await updateMemory(storage, 'project/test/memory', {
            expiresAt: newExpiry,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.expiresAt?.toISOString()).toBe('2030-12-31T00:00:00.000Z');
        }
    });

    it('should clear expiry with clearExpiry=true', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            clearExpiry: true,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.expiresAt).toBeUndefined();
        }
    });

    it('should update multiple fields at once', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'New content',
            tags: ['updated'],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.content).toBe('New content');
            expect(result.value.frontmatter.tags).toEqual(['updated']);
        }
    });

    it('should preserve createdAt and update updatedAt', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const updateTime = new Date('2025-06-20T10:00:00Z');
        const result = await updateMemory(
            storage,
            'project/test/memory',
            { content: 'Updated' },
            updateTime,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.frontmatter.createdAt.toISOString()).toBe('2025-01-15T12:00:00.000Z');
            expect(result.value.frontmatter.updatedAt.toISOString()).toBe('2025-06-20T10:00:00.000Z');
        }
    });

    it('should return INVALID_INPUT when no updates provided', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', {});
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_INPUT');
        }
    });

    it('should return MEMORY_NOT_FOUND when missing', async () => {
        const storage = createMockStorage();
        const result = await updateMemory(storage, 'project/test/memory', {
            content: 'Updated',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        }
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await updateMemory(storage, 'x', { content: 'Updated' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when read fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => err({ code: 'READ_FAILED', message: 'IO error' } as StorageAdapterError),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', { content: 'Updated' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when write fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
                write: async () => err({ code: 'WRITE_FAILED', message: 'Disk full' } as StorageAdapterError),
            },
        });
        const result = await updateMemory(storage, 'project/test/memory', { content: 'Updated' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});

// ============================================================================
// moveMemory Tests
// ============================================================================

describe('moveMemory', () => {
    it('should move memory successfully', async () => {
        let movedFrom: string | undefined;
        let movedTo: string | undefined;

        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    path === 'project/src/memory' ? ok(sampleMemoryContent) : ok(null),
                move: async (from, to) => {
                    movedFrom = from;
                    movedTo = to;
                    return ok(undefined);
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(true);
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
        expect(result.ok).toBe(true);
        expect(moveCalled).toBe(false); // Move should not be called for same path
    });

    it('should return MEMORY_NOT_FOUND for missing source', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            expect(result.error.path).toBe('project/src/memory');
        }
    });

    it('should return DESTINATION_EXISTS for existing destination', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent), // Both source and dest exist
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('DESTINATION_EXISTS');
            expect(result.error.path).toBe('project/dest/memory');
        }
    });

    it('should return INVALID_PATH for invalid source path', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'invalid', 'project/dest/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return INVALID_PATH for invalid destination path', async () => {
        const storage = createMockStorage();
        const result = await moveMemory(storage, 'project/src/memory', 'x');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should ensure destination category exists', async () => {
        let ensuredCategory: string | undefined;
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    path === 'project/src/memory' ? ok(sampleMemoryContent) : ok(null),
            },
            categories: {
                ensureCategoryDirectory: async (path) => {
                    ensuredCategory = path;
                    return ok(undefined);
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(true);
        expect(ensuredCategory).toBe('project/dest');
    });

    it('should reindex after successful move', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    path === 'project/src/memory' ? ok(sampleMemoryContent) : ok(null),
            },
            indexes: {
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });

        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should return STORAGE_ERROR when move fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    path === 'project/src/memory' ? ok(sampleMemoryContent) : ok(null),
                move: async () => err({ code: 'WRITE_FAILED', message: 'Move failed' } as StorageAdapterError),
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when reindex fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async (path) =>
                    path === 'project/src/memory' ? ok(sampleMemoryContent) : ok(null),
            },
            indexes: {
                reindex: async () =>
                    err({ code: 'INDEX_UPDATE_FAILED', message: 'Reindex failed' } as StorageAdapterError),
            },
        });
        const result = await moveMemory(storage, 'project/src/memory', 'project/dest/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});

// ============================================================================
// removeMemory Tests
// ============================================================================

describe('removeMemory', () => {
    it('should remove existing memory', async () => {
        let removedPath: string | undefined;
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
                remove: async (path) => {
                    removedPath = path;
                    return ok(undefined);
                },
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(true);
        expect(removedPath).toBe('project/test/memory');
    });

    it('should reindex after successful remove', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
            indexes: {
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should return MEMORY_NOT_FOUND for missing memory', async () => {
        const storage = createMockStorage();
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        }
    });

    it('should return INVALID_PATH for malformed path', async () => {
        const storage = createMockStorage();
        const result = await removeMemory(storage, 'x');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_PATH');
        }
    });

    it('should return STORAGE_ERROR when read fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => err({ code: 'READ_FAILED', message: 'IO error' } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when remove fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
                remove: async () => err({ code: 'WRITE_FAILED', message: 'Delete failed' } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should return STORAGE_ERROR when reindex fails', async () => {
        const storage = createMockStorage({
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
            indexes: {
                reindex: async () =>
                    err({ code: 'INDEX_UPDATE_FAILED', message: 'Reindex failed' } as StorageAdapterError),
            },
        });
        const result = await removeMemory(storage, 'project/test/memory');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });
});

// ============================================================================
// listMemories Tests
// ============================================================================

describe('listMemories', () => {
    it('should list memories in a category', async () => {
        // Index for the main category with 2 memories and 1 subcategory
        const mainIndex = `memories:
  - path: project/test/memory1
    token_estimate: 100
  - path: project/test/memory2
    token_estimate: 150
subcategories:
  - path: project/test/sub
    memory_count: 2`;
        // Empty index for the subcategory (no recursive collection wanted for this test)
        const subIndex = `memories: []
subcategories: []`;

        const storage = createMockStorage({
            indexes: {
                read: async (path) => {
                    if (path === 'project/test') return ok(mainIndex);
                    if (path === 'project/test/sub') return ok(subIndex);
                    return ok(null);
                },
            },
            memories: {
                read: async () => ok(sampleMemoryContent),
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.category).toBe('project/test');
            expect(result.value.memories.length).toBe(2);
            expect(result.value.subcategories.length).toBe(1);
            expect(result.value.subcategories[0]?.path).toBe('project/test/sub');
        }
    });

    it('should return empty results for empty category', async () => {
        const storage = createMockStorage();
        const result = await listMemories(storage, { category: 'project/empty' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories).toEqual([]);
            expect(result.value.subcategories).toEqual([]);
        }
    });

    it('should filter expired memories by default', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(`memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`),
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, { category: 'project/test', now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories).toEqual([]);
        }
    });

    it('should include expired memories when includeExpired=true', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(`memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`),
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, { category: 'project/test', includeExpired: true, now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.isExpired).toBe(true);
        }
    });

    it('should list root categories when no category specified', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async (name) => {
                    if (name === 'project') {
                        return ok(`memories: []
subcategories: []`);
                    }
                    return ok(null);
                },
            },
        });
        const result = await listMemories(storage);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.category).toBe('');
        }
    });

    it('should handle memories that fail to parse gracefully', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(`memories:
  - path: project/test/valid
    token_estimate: 100
  - path: project/test/invalid
    token_estimate: 50
subcategories: []`),
            },
            memories: {
                read: async (path) => {
                    if (path === 'project/test/valid') {
                        return ok(sampleMemoryContent);
                    }
                    // Return invalid content for the other path
                    return ok('invalid content without frontmatter');
                },
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            // Should only include the valid memory, gracefully skipping the invalid one
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path).toBe('project/test/valid');
        }
    });

    it('should handle missing memory files gracefully', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () =>
                    ok(`memories:
  - path: project/test/exists
    token_estimate: 100
  - path: project/test/missing
    token_estimate: 50
subcategories: []`),
            },
            memories: {
                read: async (path) => {
                    if (path === 'project/test/exists') {
                        return ok(sampleMemoryContent);
                    }
                    return ok(null); // Missing
                },
            },
        });
        const result = await listMemories(storage, { category: 'project/test' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path).toBe('project/test/exists');
        }
    });
});

// ============================================================================
// pruneExpiredMemories Tests
// ============================================================================

describe('pruneExpiredMemories', () => {
    it('should return empty list when no expired memories', async () => {
        const storage = createMockStorage({
            indexes: {
                read: async () => ok(null), // No indexes
            },
        });
        const result = await pruneExpiredMemories(storage);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toEqual([]);
        }
    });

    it('should return candidates without deleting in dry run mode', async () => {
        const indexContent = `memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`;

        let deleteCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async (path) => (path === 'project' ? ok(indexContent) : ok(null)),
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
                remove: async () => {
                    deleteCalled = true;
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { dryRun: true, now });
        expect(result.ok).toBe(true);
        expect(deleteCalled).toBe(false);
        if (result.ok && result.value.pruned.length > 0) {
            expect(result.value.pruned[0]?.path).toBe('project/test/expired');
        }
    });

    it('should delete expired memories when not in dry run mode', async () => {
        const indexContent = `memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`;

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path) => (path === 'project' ? ok(indexContent) : ok(null)),
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
                remove: async (path) => {
                    deletedPaths.push(path);
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned.length).toBe(1);
            expect(deletedPaths).toContain('project/test/expired');
        }
    });

    it('should reindex after pruning when memories were deleted', async () => {
        const indexContent = `memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`;

        let reindexCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async (path) => (path === 'project' ? ok(indexContent) : ok(null)),
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok).toBe(true);
        expect(reindexCalled).toBe(true);
    });

    it('should not reindex when no memories were pruned', async () => {
        let reindexCalled = false;
        const storage = createMockStorage({
            indexes: {
                read: async () => ok(null),
                reindex: async () => {
                    reindexCalled = true;
                    return ok({ warnings: [] });
                },
            },
        });

        const result = await pruneExpiredMemories(storage);
        expect(result.ok).toBe(true);
        expect(reindexCalled).toBe(false);
    });

    it('should return STORAGE_ERROR when delete fails', async () => {
        const indexContent = `memories:
  - path: project/test/expired
    token_estimate: 100
subcategories: []`;

        const storage = createMockStorage({
            indexes: {
                read: async (path) => (path === 'project' ? ok(indexContent) : ok(null)),
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
                remove: async () =>
                    err({ code: 'WRITE_FAILED', message: 'Delete failed' } as StorageAdapterError),
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORAGE_ERROR');
        }
    });

    it('should skip non-expired memories', async () => {
        const indexContent = `memories:
  - path: project/test/active
    token_estimate: 100
subcategories: []`;

        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path) => (path === 'project' ? ok(indexContent) : ok(null)),
            },
            memories: {
                read: async () => ok(memoryWithExpiry), // Not expired
                remove: async (path) => {
                    deletedPaths.push(path);
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toEqual([]);
            expect(deletedPaths).toEqual([]);
        }
    });

    it('should prune across multiple root categories', async () => {
        const deletedPaths: string[] = [];
        const storage = createMockStorage({
            indexes: {
                read: async (path) => {
                    if (path === 'project') {
                        return ok(`memories:
  - path: project/expired1
    token_estimate: 100
subcategories: []`);
                    }
                    if (path === 'human') {
                        return ok(`memories:
  - path: human/expired2
    token_estimate: 50
subcategories: []`);
                    }
                    return ok(null);
                },
            },
            memories: {
                read: async () => ok(expiredMemoryContent),
                remove: async (path) => {
                    deletedPaths.push(path);
                    return ok(undefined);
                },
            },
        });

        const now = new Date('2025-06-15T12:00:00Z');
        const result = await pruneExpiredMemories(storage, { now });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned.length).toBe(2);
            expect(deletedPaths).toContain('project/expired1');
            expect(deletedPaths).toContain('human/expired2');
        }
    });
});
