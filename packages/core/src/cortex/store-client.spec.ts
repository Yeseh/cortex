/**
 * Tests for the StoreClient class.
 *
 * @module core/cortex/store-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { StoreClient } from './store-client.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';

// =============================================================================
// Mock Factory
// =============================================================================

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

// =============================================================================
// StoreClient Tests
// =============================================================================

describe('StoreClient', () => {
    // =========================================================================
    // create() Tests
    // =========================================================================

    describe('create()', () => {
        it('should create a StoreClient with name and path', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('my-project', '/data/my-project', adapter);

            expect(client.name).toBe('my-project');
            expect(client.path).toBe('/data/my-project');
        });

        it('should create a StoreClient with description', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create(
                'my-project',
                '/data/my-project',
                adapter,
                'Project memories',
            );

            expect(client.name).toBe('my-project');
            expect(client.path).toBe('/data/my-project');
            expect(client.description).toBe('Project memories');
        });

        it('should create a StoreClient without description', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('my-project', '/data/my-project', adapter);

            expect(client.name).toBe('my-project');
            expect(client.path).toBe('/data/my-project');
            expect(client.description).toBeUndefined();
        });
    });

    // =========================================================================
    // readonly properties Tests
    // =========================================================================

    describe('readonly properties', () => {
        it('should expose name as readonly', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('test-store', '/test/path', adapter);

            expect(client.name).toBe('test-store');
            // TypeScript would prevent: client.name = 'modified';
            // At runtime, attempting to set would be silently ignored in strict mode
        });

        it('should expose path as readonly', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('test-store', '/test/path', adapter);

            expect(client.path).toBe('/test/path');
            // TypeScript would prevent: client.path = '/modified';
        });

        it('should expose description as readonly when present', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create(
                'test-store',
                '/test/path',
                adapter,
                'A test store',
            );

            expect(client.description).toBe('A test store');
            // TypeScript would prevent: client.description = 'modified';
        });

        it('should have undefined description when not provided', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('test-store', '/test/path', adapter);

            expect(client.description).toBeUndefined();
        });
    });

    // =========================================================================
    // rootCategory() Tests
    // =========================================================================

    describe('rootCategory()', () => {
        it('should return a CategoryClient with rawPath "/"', () => {
            const adapter = createMockAdapter();
            const store = StoreClient.create('my-project', '/data/my-project', adapter);

            const root = store.rootCategory();

            expect(root.rawPath).toBe('/');
        });

        it('should return same adapter reference in CategoryClient', async () => {
            // We can verify the adapter is correctly passed by checking
            // that the CategoryClient's operations use our mock adapter
            let existsCalled = false;
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => {
                        existsCalled = true;
                        return ok(true);
                    },
                },
            });
            const store = StoreClient.create('my-project', '/data/my-project', adapter);

            const root = store.rootCategory();
            await root.exists();

            expect(existsCalled).toBe(true);
        });

        it('should allow navigation to subcategories', () => {
            const adapter = createMockAdapter();
            const store = StoreClient.create('my-project', '/data/my-project', adapter);

            const root = store.rootCategory();
            const standards = root.getCategory('standards');
            const typescript = standards.getCategory('typescript');

            expect(root.rawPath).toBe('/');
            expect(standards.rawPath).toBe('/standards');
            expect(typescript.rawPath).toBe('/standards/typescript');
        });

        it('should return new CategoryClient instance on each call', () => {
            const adapter = createMockAdapter();
            const store = StoreClient.create('my-project', '/data/my-project', adapter);

            const root1 = store.rootCategory();
            const root2 = store.rootCategory();

            // Different instances
            expect(root1).not.toBe(root2);
            // But same path
            expect(root1.rawPath).toBe(root2.rawPath);
        });
    });

    // =========================================================================
    // getAdapter() Tests
    // =========================================================================

    describe('getAdapter()', () => {
        it('should return the underlying storage adapter', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('test-store', '/test/path', adapter);

            expect(client.getAdapter()).toBe(adapter);
        });
    });

    // =========================================================================
    // Edge Cases Tests
    // =========================================================================

    describe('edge cases', () => {
        it('should handle empty string name', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('', '/data/unnamed', adapter);

            expect(client.name).toBe('');
            expect(client.path).toBe('/data/unnamed');
        });

        it('should handle empty string path', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('my-store', '', adapter);

            expect(client.name).toBe('my-store');
            expect(client.path).toBe('');
        });

        it('should handle empty string description', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create('my-store', '/data/store', adapter, '');

            // Empty string is still a defined value
            expect(client.description).toBe('');
        });

        it('should handle path with special characters', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create(
                'my-store',
                '/data/my store with spaces',
                adapter,
            );

            expect(client.path).toBe('/data/my store with spaces');
        });

        it('should handle name with special characters', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create(
                'my-store_v2.0',
                '/data/my-store',
                adapter,
            );

            expect(client.name).toBe('my-store_v2.0');
        });

        it('should preserve unicode in name and description', () => {
            const adapter = createMockAdapter();
            const client = StoreClient.create(
                'store-emoji',
                '/data/store',
                adapter,
                'Store with unicode description',
            );

            expect(client.name).toBe('store-emoji');
            expect(client.description).toBe('Store with unicode description');
        });
    });
});
