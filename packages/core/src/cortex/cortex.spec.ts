/**
 * Tests for Cortex.
 *
 * @module core/cortex/cortex.spec
 */

import { describe, expect, it } from 'bun:test';
import { Cortex, createDefaultAdapterFactory } from './cortex.ts';
import type { AdapterFactory } from './types.ts';
import type { StorageAdapter } from '@/storage/index.ts';
import { createMockStorageAdapter } from '@/test/mock-storage-adapter.ts';

describe('Cortex.init()', () => {
    it('should apply default settings when none are provided', () => {
        const cortex = Cortex.init({
            registry: {},
            adapterFactory: () => createMockStorageAdapter(),
        });

        expect(cortex.settings.outputFormat).toBe('yaml');
        expect(cortex.settings.defaultStore).toBe('default');
    });

    it('should merge custom settings with defaults', () => {
        const cortex = Cortex.init({
            settings: { outputFormat: 'json' },
            registry: {},
            adapterFactory: () => createMockStorageAdapter(),
        });

        expect(cortex.settings.outputFormat).toBe('json');
        expect(cortex.settings.defaultStore).toBe('default');
    });
});

describe('Cortex.getStore()', () => {
    it('should return STORE_NOT_FOUND for missing store name', () => {
        const cortex = Cortex.init({
            registry: {},
            adapterFactory: () => createMockStorageAdapter(),
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
            return createMockStorageAdapter();
        };

        const cortex = Cortex.init({
            registry: {
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
        expect(receivedPath).toBe('/data/project');
        expect(result.value.name).toBe('project');
        expect(result.value.path).toBe('/data/project');
        expect(result.value.description).toBe('Project store');
    });

    it('should return INVALID_STORE_ADAPTER when factory returns undefined', () => {
        const badFactory: AdapterFactory = () => undefined as unknown as StorageAdapter;

        const cortex = Cortex.init({
            registry: {
                project: { 
                    kind: 'filesystem',
                    properties: { path: '/data/project' },
                    categories: {} },
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
                project: { 
                    kind: 'filesystem',
                    properties: { path: '/data/project' },
                    categories: {} },
            },
            adapterFactory: createDefaultAdapterFactory(),
        });

        expect(() => cortex.getStore('project')).toThrow('No adapter factory provided');
    });
});
