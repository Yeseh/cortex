/**
 * Tests for Cortex.
 *
 * @module core/cortex/cortex.spec
 */

import { describe, expect, it } from 'bun:test';
import { Cortex } from './cortex.ts';
import type { AdapterFactory } from './types.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';

const createMockAdapter = (): ScopedStorageAdapter => ({
    memories: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
    },
    indexes: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
    },
    categories: {
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        updateSubcategoryDescription: async () => ok(undefined),
        removeSubcategoryEntry: async () => ok(undefined),
    },
}) as ScopedStorageAdapter;

describe('Cortex.init()', () => {
    it('should apply default settings when none are provided', () => {
        const cortex = Cortex.init({
            registry: {},
            adapterFactory: () => createMockAdapter(),
        });

        expect(cortex.settings.outputFormat).toBe('yaml');
        expect(cortex.settings.defaultStore).toBeUndefined();
    });

    it('should merge custom settings with defaults', () => {
        const cortex = Cortex.init({
            settings: { outputFormat: 'json' },
            registry: {},
            adapterFactory: () => createMockAdapter(),
        });

        expect(cortex.settings.outputFormat).toBe('json');
        expect(cortex.settings.defaultStore).toBeUndefined();
    });
});

describe('Cortex.getStore()', () => {
    it('should return STORE_NOT_FOUND for missing store name', () => {
        const cortex = Cortex.init({
            registry: {},
            adapterFactory: () => createMockAdapter(),
        });

        const result = cortex.getStore('missing');

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('STORE_NOT_FOUND');
    });

    it('should return a StoreClient for configured store', () => {
        let receivedPath = '';
        const factory: AdapterFactory = (storePath) => {
            receivedPath = storePath;
            return createMockAdapter();
        };

        const cortex = Cortex.init({
            registry: {
                project: {
                    path: '/data/project',
                    description: 'Project store',
                    categories: {},
                },
            },
            adapterFactory: factory,
        });

        const result = cortex.getStore('project');

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(receivedPath).toBe('/data/project');
        expect(result.value.name).toBe('project');
        expect(result.value.path).toBe('/data/project');
        expect(result.value.description).toBe('Project store');
    });

    it('should return INVALID_STORE_ADAPTER when factory returns undefined', () => {
        const badFactory: AdapterFactory = () => undefined as unknown as ScopedStorageAdapter;

        const cortex = Cortex.init({
            registry: {
                project: { path: '/data/project', categories: {} },
            },
            adapterFactory: badFactory,
        });

        const result = cortex.getStore('project');

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('INVALID_STORE_ADAPTER');
    });

    it('should throw when using default adapter factory', () => {
        const cortex = Cortex.init({
            registry: {
                project: { path: '/data/project', categories: {} },
            },
        });

        expect(() => cortex.getStore('project')).toThrow('No adapter factory provided');
    });
});
