/**
 * Unit tests for the initializeStore operation.
 *
 * @module core/store/operations/initialize.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { err, ok } from '@/result.ts';
import { initializeStore } from './initialize.ts';
import type { Store, StoreData } from '../store.ts';
import type { CategoryPath } from '@/category/category-path.ts';
import { createMockStorageAdapter } from '@/testing/mock-storage-adapter.ts';

describe('initializeStore', () => {
    it('should reject invalid store names', async () => {
        const load = mock(async () =>
            err({
                code: 'STORE_NOT_FOUND',
                message: 'Store not found',
            }),
        );
        const adapter = createMockStorageAdapter({
            stores: { load },
        });

        const result = await initializeStore(adapter, '   ', {
            kind: 'local',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_NAME_INVALID');
        }
        expect(load.mock.calls.length).toBe(0);
    });

    it('should reject duplicate store names', async () => {
        const existingStore: Store = {
            name: 'my-store' as Store['name'],
            kind: 'local',
        };

        const adapter = createMockStorageAdapter({
            stores: {
                load: async () => ok(existingStore),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('DUPLICATE_STORE_NAME');
        }
    });

    it('should return unexpected load errors', async () => {
        const adapter = createMockStorageAdapter({
            stores: {
                load: async () =>
                    err({
                        code: 'REGISTRY_READ_FAILED',
                        message: 'Cannot read registry',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('REGISTRY_READ_FAILED');
        }
    });

    it('should initialize a store without categories', async () => {
        const save = mock(async () => ok(undefined));
        const ensure = mock(async () => ok(undefined));
        const adapter = createMockStorageAdapter({
            stores: { save },
            categories: { ensure },
        });

        const data: StoreData = {
            kind: 'local',
            description: 'Test store',
        };

        const result = await initializeStore(adapter, 'my-store', data);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.name.toString()).toBe('my-store');
            expect(result.value.kind).toBe('local');
            expect(result.value.description).toBe('Test store');
        }

        expect(save.mock.calls.length).toBe(1);
        expect(ensure.mock.calls.length).toBe(0);
    });

    it('should initialize configured categories', async () => {
        const ensure = mock(async () => ok(undefined));
        const adapter = createMockStorageAdapter({
            categories: { ensure },
        });

        const data: StoreData = {
            kind: 'local',
            categories: {
                standards: {
                    path: 'standards' as CategoryPath,
                },
                projects: {
                    path: 'projects/cortex' as CategoryPath,
                },
            },
        };

        const result = await initializeStore(adapter, 'my-store', data);

        expect(result.ok()).toBe(true);
        expect(ensure.mock.calls.length).toBe(2);
        expect(ensure.mock.calls[0]?.[0]).toBe('standards');
        expect(ensure.mock.calls[1]?.[0]).toBe('projects/cortex');
    });

    it('should return STORE_CREATE_FAILED errors from save', async () => {
        const adapter = createMockStorageAdapter({
            stores: {
                save: async () =>
                    err({
                        code: 'STORE_CREATE_FAILED',
                        message: 'Failed to create store',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_CREATE_FAILED');
        }
    });

    it('should return STORE_INDEX_FAILED when category initialization fails', async () => {
        const adapter = createMockStorageAdapter({
            categories: {
                ensure: async () =>
                    err({
                        code: 'INVALID_PATH',
                        message: 'Invalid category path',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
            categories: {
                standards: {
                    path: 'standards' as CategoryPath,
                },
            },
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_CRATE_FAILED');
        }
    });
});
