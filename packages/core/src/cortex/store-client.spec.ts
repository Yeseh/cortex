/**
 * Tests for StoreClient.
 *
 * @module core/cortex/store-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { StoreClient } from './store-client.ts';
import type { StorageAdapter } from '@/storage/index.ts';
import { ok } from '@/result.ts';
import { createMockStorageAdapter } from '@/test/mock-storage-adapter.ts';

describe('StoreClient.init()', () => {
    it('should create a store client for valid adapter input', () => {
        const result = StoreClient.init('my-store', '/data/my-store', createMockStorageAdapter(), 'Test store');

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.name).toBe('my-store');
        expect(result.value.path).toBe('/data/my-store');
        expect(result.value.description).toBe('Test store');
    });

    it('should return INVALID_STORE_ADAPTER when adapter is missing', () => {
        const result = StoreClient.init('my-store', '/data/my-store', undefined as unknown as StorageAdapter);

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('INVALID_STORE_ADAPTER');
    });
});

describe('StoreClient.root()', () => {
    it('should return root category client with path "/"', () => {
        const storeResult = StoreClient.init('my-store', '/data/my-store', createMockStorageAdapter());
        expect(storeResult.ok()).toBe(true);
        if (!storeResult.ok()) return;

        const rootResult = storeResult.value.root();

        expect(rootResult.ok()).toBe(true);
        if (!rootResult.ok()) return;
        expect(rootResult.value.rawPath).toBe('/');
    });

    it('should pass adapter through to category operations', async () => {
        let existsCalled = false;
        const adapter = createMockStorageAdapter({
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
