/**
 * Shared test helpers for memory operation tests.
 *
 * Provides mock factories, result constructors, and sample fixtures
 * used across all operation spec files.
 *
 * @module core/memory/operations/_test-helpers
 */

import type { StorageAdapter } from '@/storage';
import { err, ok } from '@/result.ts';
import { Memory, type MemoryMetadata } from '@/memory/memory.ts';
import type { Category } from '@/category/types.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { MemoryPath } from '@/memory/memory-path.ts';
import { createMockStorageAdapter, type StorageAdapterOverrides } from '@/testing/mock-storage-adapter';


// ============================================================================
// Index Builder
// ============================================================================

export const buildIndex = (
    memories: Category['memories'],
    subcategories: Category['subcategories'],
): Category => ({
    memories,
    subcategories,
});

// ============================================================================
// Mock Storage Adapter Factory
// ============================================================================

export const createMockStorage = (
    overrides: StorageAdapterOverrides = {},
): StorageAdapter => createMockStorageAdapter({
    memories: {
        load: overrides.memories?.load ?? overrides.memories?.load ?? (async () => ok(null)),
        save: overrides.memories?.save ?? overrides.memories?.save ?? (async () => ok(undefined)),
        add: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
        ...overrides.memories,
    },
    indexes: {
        load: overrides.indexes?.load ?? overrides.indexes?.load ?? (async () => ok(null)),
        write: async () => ok(undefined),
        reindex: async (_scope: CategoryPath) => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
        ...overrides.indexes,
    },
    categories: {
        exists: async () => ok(true),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        setDescription: (
            overrides.categories?.setDescription
            ?? (async () => ok(undefined))
        ),
        ...overrides.categories,
    },
    stores: {
        load: async () => err({ code: 'STORE_NOT_FOUND', message: 'Store not found' }),
        save: async () => ok(undefined),
        remove: async () => ok(undefined),
        ...overrides.stores,
    }
});

// ============================================================================
// Path Helpers
// ============================================================================

export const categoryPath = (path: string): CategoryPath => (
    path === '' ? CategoryPath.root() : CategoryPath.fromString(path).unwrap()
);

export const memoryPath = (path: string): MemoryPath => (
    MemoryPath.fromString(path).unwrap()
);

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
