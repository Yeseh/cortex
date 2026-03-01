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
import { defaultProjectCategories } from '@/category/category-templates.ts';
import { configCategoriesToStoreCategories } from '@/config/config.ts';
import { createMockStorageAdapter } from '@/testing/mock-storage-adapter.ts';
import type { StoreCategories } from '../store.ts';

/** Recursively count all category nodes (including subcategories) */
const countAll = (cats: StoreCategories): number =>
    cats.reduce((acc, c) => acc + 1 + countAll(c.subcategories ?? []), 0);

/** Recursively count nodes that have a description */
const countWithDesc = (cats: StoreCategories): number =>
    cats.reduce(
        (acc, c) => acc + (c.description ? 1 : 0) + countWithDesc(c.subcategories ?? []),
        0
    );

const defaultCategories = configCategoriesToStoreCategories(defaultProjectCategories).unwrap();
/** Total nodes across all depths in defaultProjectCategories */
const DEFAULT_CATEGORY_COUNT = countAll(defaultCategories);
/** Nodes with a description (will trigger setDescription calls) */
const DEFAULT_DESCRIPTION_COUNT = countWithDesc(defaultCategories);

describe('initializeStore', () => {
    it('should reject invalid store names', async () => {
        const load = mock(async () =>
            err({
                code: 'CONFIG_NOT_FOUND' as const,
                message: 'Store not found',
            })
        );
        const adapter = createMockStorageAdapter({
            config: { getStore: load },
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
            config: {
                getStore: async () =>
                    ok({
                        kind: existingStore.kind,
                        categoryMode: existingStore.categoryMode,
                        categories: {},
                        properties: existingStore.properties,
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
            expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
        }
    });

    it('should return unexpected load errors', async () => {
        const adapter = createMockStorageAdapter({
            config: {
                getStore: async () =>
                    err({
                        code: 'CONFIG_READ_FAILED' as const,
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

    it('should seed default project categories when no categories are provided', async () => {
        const save = mock(async () => ok(undefined));
        const ensure = mock(async () => ok(undefined));
        const setDescription = mock(async () => ok(undefined));
        const adapter = createMockStorageAdapter({
            config: { saveStore: save },
            categories: { ensure, setDescription },
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
        // saveStore must be called with the resolved default categories, not the original empty array
        const savedData = (save.mock.calls as unknown as [string, StoreData][])[0]?.[1];
        expect(savedData?.categories.length).toBe(Object.keys(defaultProjectCategories).length);
        // Root + one ensure per category node (including subcategories)
        expect(ensure.mock.calls.length).toBe(1 + DEFAULT_CATEGORY_COUNT);
        // setDescription called for every node that has a description
        expect(setDescription.mock.calls.length).toBe(DEFAULT_DESCRIPTION_COUNT);
        const firstCallArg = (ensure.mock.calls as unknown as [CategoryPath[]])[0]?.[0];
        expect(firstCallArg?.toString()).toBe(CategoryPath.root().toString());
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
        // Explicit categories override defaults: root + 2 configured (not default)
        expect(ensure.mock.calls.length).toBe(3); // root + 2 configured categories
    });

    it('should return STORE_CREATE_FAILED errors from save', async () => {
        const adapter = createMockStorageAdapter({
            config: {
                saveStore: async () =>
                    err({
                        code: 'CONFIG_WRITE_FAILED' as const,
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

    it('should return STORE_CREATE_FAILED when root directory creation fails', async () => {
        const adapter = createMockStorageAdapter({
            categories: {
                ensure: async () =>
                    err({
                        code: 'INVALID_PATH' as const,
                        message: 'Cannot create root directory',
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
            categories: [
                {
                    path: CategoryPath.fromString('standards').unwrap(),
                    subcategories: [],
                },
            ],
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_CREATE_FAILED');
        }
    });
});
