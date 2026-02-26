import type { StorageAdapter } from '@/storage/index.ts';
import { err, ok } from '@/result.ts';

export type StorageAdapterOverrides = Partial<{
    memories: Partial<StorageAdapter['memories']>;
    indexes: Partial<StorageAdapter['indexes']>;
    categories: Partial<StorageAdapter['categories']>;
    config: Partial<StorageAdapter['config']>;
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
    config: {
        path: '/tmp/cortex-test-config.yaml',
        data: null,
        stores: null,
        settings: null,
        initializeConfig: async () => ok(undefined),
        getSettings: async () => ok({}),
        getStores: async () => ok({}),
        getStore: async () => ok(null),
        saveStore: async () => ok(undefined),
        ...overrides?.config,
    },
});
