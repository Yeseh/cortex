import type { StorageAdapter } from '@/storage/index.ts';
import { err, ok } from '@/result.ts';

export type StorageAdapterOverrides = Partial<{
    memories: Partial<StorageAdapter['memories']>;
    indexes: Partial<StorageAdapter['indexes']>;
    categories: Partial<StorageAdapter['categories']>;
    stores: Partial<StorageAdapter['stores']>;
}>;

export const createMockStorageAdapter = (
    overrides?: StorageAdapterOverrides,
): StorageAdapter => ({
    memories: {
        load: async () => ok(null),
        save: async () => ok(undefined),
        add: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
        ...overrides?.memories,
    },
    indexes: {
        load: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
        ...overrides?.indexes,
    },
    categories: {
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        setDescription: async () => ok(undefined),
        ...overrides?.categories,
    },
    stores: {
        load: async () =>
            err({
                code: 'STORE_NOT_FOUND',
                message: 'Store not found',
            }),
        save: async () => ok(undefined),
        remove: async () => ok(undefined),
        ...overrides?.stores,
    },
});
