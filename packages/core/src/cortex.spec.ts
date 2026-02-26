/**
 * Tests for Cortex.
 *
 * @module core/cortex/cortex.spec
 */

import { describe, expect, it } from 'bun:test';
import { Cortex, createDefaultAdapterFactory } from './cortex.ts';
import type { AdapterFactory } from './types.ts';
import type { StorageAdapter } from '@/storage/index.ts';
import { createMockStorageAdapter } from '@/testing/mock-storage-adapter.ts';

describe('Cortex.getStore()', () => {
    it('should return a StoreClient for any name when adapter factory is valid', () => {
        const cortex = Cortex.init({
            stores: {},
            adapterFactory: () => createMockStorageAdapter(),
        });

        const result = cortex.getStore('any-store-name');

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.name).toBe('any-store-name');
    });

    it('should return a StoreClient for configured store', () => {
        let receivedName = '';
        const factory: AdapterFactory = (storeName) => {
            receivedName = storeName;
            return createMockStorageAdapter();
        };

        const cortex = Cortex.init({
            stores: {
                project: {
                    kind: 'filesystem',
                    properties: { path: '/data/project' },
                    description: 'Project store',
                    categories: {},
                },
            },
            adapterFactory: factory,
        });

        const result = cortex.getStore('project');

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;

        expect(receivedName).toBe('project');
        expect(result.value.name).toBe('project');
    });

    it('should return INVALID_STORE_ADAPTER when factory returns undefined', () => {
        const badFactory: AdapterFactory = () => undefined as unknown as StorageAdapter;

        const cortex = Cortex.init({
            stores: {
                project: {
                    kind: 'filesystem',
                    properties: { path: '/data/project' },
                    categories: {},
                },
            },
            adapterFactory: badFactory,
        });

        const result = cortex.getStore('project');

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('INVALID_STORE_ADAPTER');
    });

    it('should return STORE_NOT_FOUND when using default adapter factory', () => {
        const cortex = Cortex.init({
            stores: {
                project: {
                    kind: 'filesystem',
                    properties: { path: '/data/project' },
                    categories: {},
                },
            },
            adapterFactory: createDefaultAdapterFactory(),
        });

        const result = cortex.getStore('project');

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('STORE_NOT_FOUND');
        expect(result.error.message).toContain('No adapter factory provided');
    });
});
