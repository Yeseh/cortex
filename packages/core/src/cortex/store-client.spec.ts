/**
 * Tests for StoreClient.
 *
 * @module core/cortex/store-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { StoreClient } from './store-client.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';

const createMockAdapter = (overrides?: Partial<{
    memories: Partial<ScopedStorageAdapter['memories']>;
    indexes: Partial<ScopedStorageAdapter['indexes']>;
    categories: Partial<ScopedStorageAdapter['categories']>;
}>): ScopedStorageAdapter => ({
    memories: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
        ...overrides?.memories,
    },
    indexes: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
        ...overrides?.indexes,
    },
    categories: {
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        updateSubcategoryDescription: async () => ok(undefined),
        removeSubcategoryEntry: async () => ok(undefined),
        ...overrides?.categories,
    },
}) as ScopedStorageAdapter;

describe('StoreClient.init()', () => {
    it('should create a store client for valid adapter input', () => {
        const result = StoreClient.init('my-store', '/data/my-store', createMockAdapter(), 'Test store');

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.name).toBe('my-store');
        expect(result.value.path).toBe('/data/my-store');
        expect(result.value.description).toBe('Test store');
    });

    it('should return INVALID_STORE_ADAPTER when adapter is missing', () => {
        const result = StoreClient.init('my-store', '/data/my-store', undefined as unknown as ScopedStorageAdapter);

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('INVALID_STORE_ADAPTER');
    });
});

describe('StoreClient.root()', () => {
    it('should return root category client with path "/"', () => {
        const storeResult = StoreClient.init('my-store', '/data/my-store', createMockAdapter());
        expect(storeResult.ok()).toBe(true);
        if (!storeResult.ok()) return;

        const rootResult = storeResult.value.root();

        expect(rootResult.ok()).toBe(true);
        if (!rootResult.ok()) return;
        expect(rootResult.value.rawPath).toBe('/');
    });

    it('should pass adapter through to category operations', async () => {
        let existsCalled = false;
        const adapter = createMockAdapter({
            categories: {
                exists: async () => {
                    existsCalled = true;
                    return ok(true);
                },
            },
        });

        const storeResult = StoreClient.init('my-store', '/data/my-store', adapter);
        expect(storeResult.ok()).toBe(true);
        if (!storeResult.ok()) return;

        const rootResult = storeResult.value.root();
        expect(rootResult.ok()).toBe(true);
        if (!rootResult.ok()) return;

        const existsResult = await rootResult.value.exists();

        expect(existsResult.ok()).toBe(true);
        if (!existsResult.ok()) return;
        expect(existsResult.value).toBe(true);
        expect(existsCalled).toBe(true);
    });
});
