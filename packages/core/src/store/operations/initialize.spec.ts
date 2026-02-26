/**
 * Unit tests for the initializeStore operation.
 *
 * @module core/store/operations/initialize.spec
 */

import { describe, expect, it, mock } from 'bun:test';
import { err, ok } from '@/result.ts';
import { initializeStore } from './initialize.ts';
import type { Store, StoreData } from '../store.ts';
import { Slug } from '@/slug.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { createMockStorageAdapter } from '@/testing/mock-storage-adapter.ts';

describe('initializeStore', () => {
    it('should reject invalid store names', async () => {
        const load = mock(async () =>
            err({
                code: 'STORE_NOT_FOUND' as const,
                message: 'Store not found',
            }),
        );
        const adapter = createMockStorageAdapter({
            stores: { load },
        });

        const result = await initializeStore(adapter, '   ', {
            kind: 'local',
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_NAME_INVALID');
        }
        expect(load.mock.calls.length).toBe(0);
    });

    it('should reject duplicate store names', async () => {
        const existingStore: Store = {
            name: Slug.fromUnsafe('my-store'),
            kind: 'local',
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        };

        const adapter = createMockStorageAdapter({
            stores: {
                load: async () => ok(existingStore),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
        }
    });

    it('should return unexpected load errors', async () => {
        const adapter = createMockStorageAdapter({
            stores: {
                load: async () =>
                    err({
                        code: 'STORE_READ_FAILED' as const,
                        message: 'Cannot read registry',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_READ_FAILED');
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
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        };

        const result = await initializeStore(adapter, 'my-store', data);

        expect(result.ok()).toBe(true);
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
            categoryMode: 'free',
            properties: {
                path: '/path/to/store',
            },
            categories: [
                {
                    path: CategoryPath.fromString('standards').unwrap(),
                    subcategories: [],
                },
                {
                    path: CategoryPath.fromString('projects').unwrap(),
                    subcategories: [],
                },
            ],
        };

        const result = await initializeStore(adapter, 'my-store', data);

        expect(result.ok()).toBe(true);
        expect(ensure.mock.calls.length).toBe(2);
    });

    it('should return STORE_CREATE_FAILED errors from save', async () => {
        const adapter = createMockStorageAdapter({
            stores: {
                save: async () =>
                    err({
                        code: 'STORE_CREATE_FAILED' as const,
                        message: 'Failed to create store',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
            categoryMode: 'free' as const,
            categories: [],
            properties: {},
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_CREATE_FAILED');
        }
    });

    it('should return STORE_CREATE_FAILED when category initialization fails', async () => {
        const adapter = createMockStorageAdapter({
            categories: {
                ensure: async () =>
                    err({
                        code: 'INVALID_PATH' as const,
                        message: 'Invalid category path',
                    }),
            },
        });

        const result = await initializeStore(adapter, 'my-store', {
            kind: 'local',
            categoryMode: 'free',
            properties: {
                path: '/path/to/store',
            },
            categories: [{
                path: CategoryPath.fromString('standards').unwrap(),
                subcategories: [],
            }],
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_CREATE_FAILED');
        }
    });
});
