/**
 * Shared test helpers for memory operation tests.
 *
 * Provides mock factories, result constructors, and sample fixtures
 * used across all operation spec files.
 *
 * @module core/memory/operations/_test-helpers
 */

import type {
    ComposedStorageAdapter,
    MemoryStorage,
    IndexStorage,
    StoreStorage,
} from '@/storage/adapter.ts';
import { err, ok } from '@/result.ts';
import { Memory, type MemoryMetadata } from '@/memory/memory.ts';
import { memoryError } from '@/memory/result.ts';
import type { MemorySerializer } from '@/serializer.ts';
import type { CategoryIndex } from '@/index/types.ts';
import type { CategoryStorage } from '@/category/types.ts';
import type { StoreRegistry } from '@/store/registry.ts';


// ============================================================================
// Index Builder
// ============================================================================

export const buildIndex = (
    memories: CategoryIndex['memories'],
    subcategories: CategoryIndex['subcategories'],
): CategoryIndex => ({
    memories,
    subcategories,
});

// ============================================================================
// Mock Storage Adapter Factory
// ============================================================================

export const createMockStorage = (
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
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
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

// Re-export for convenience in tests
export { ok, err };

// ============================================================================
// Sample Memory Content Fixtures
// ============================================================================

export const buildMemoryFixture = (
    path: string,
    overrides: Partial<MemoryMetadata> = {},
    content = 'Sample memory content',
): Memory => {
    const timestamp = new Date('2025-01-15T12:00:00.000Z');
    const metadata: MemoryMetadata = {
        createdAt: timestamp,
        updatedAt: timestamp,
        tags: [
            'test', 'sample',
        ],
        source: 'test',
        expiresAt: undefined,
        citations: [],
        ...overrides,
    };

    const result = Memory.init(path, metadata, content);
    if (!result.ok()) {
        throw new Error('Test setup failed to create memory.');
    }

    return result.value;
};

export const sampleMemory = buildMemoryFixture('project/test/memory');

export const expiredMemory = buildMemoryFixture(
    'project/test/expired',
    {
        tags: [],
        expiresAt: new Date('2025-01-10T12:00:00.000Z'),
        createdAt: new Date('2025-01-01T12:00:00.000Z'),
        updatedAt: new Date('2025-01-01T12:00:00.000Z'),
    },
    'Expired content',
);

export const memoryWithExpiry = buildMemoryFixture(
    'project/test/active',
    {
        tags: ['active'],
        expiresAt: new Date('2030-01-01T12:00:00.000Z'),
    },
    'Memory with future expiry',
);

export const mockSerializer: MemorySerializer = {
    parse: () => memoryError('INVALID_INPUT', 'Mock serializer not implemented.'),
    serialize: () => memoryError('INVALID_INPUT', 'Mock serializer not implemented.'),
};
