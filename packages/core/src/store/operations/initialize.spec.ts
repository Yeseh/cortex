/**
 * Tests for the initializeStore operation.
 *
 * These tests verify the complete store initialization workflow including:
 *
 * - **Root index creation**: Ensures the root index is written using
 *   CategoryPath.root() (empty string path) rather than a literal path,
 *   fixing a bug where root indexes were written incorrectly.
 *
 * - **Category index creation**: Verifies that optional category directories
 *   are created with proper indexes, including support for nested paths
 *   like 'project/cortex'.
 *
 * - **Registry integration**: Confirms stores are properly registered with
 *   path and optional description metadata.
 *
 * - **Error handling**: Tests validation of store names, duplicate detection,
 *   and graceful handling of index write failures.
 *
 * The tests use a mock Registry factory that tracks written indexes in a Map,
 * allowing assertions on index structure without filesystem dependencies.
 *
 * @module core/store/operations/initialize.spec
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ok, err } from '@/result.ts';
import { CategoryPath } from '@/category/category-path.ts';
import type { CategoryIndex } from '@/index/types.ts';
import type {
    Registry,
    ScopedStorageAdapter,
    RegistryError,
    StoreNotFoundError,
    IndexStorage,
    MemoryStorage,
    StorageAdapterError,
} from '@/storage/adapter.ts';
import type { CategoryStorage } from '@/category/types.ts';
import type { StoreRegistry } from '@/store/registry.ts';
import { initializeStore } from './initialize.ts';

// ============================================================================
// Mock Factory
// ============================================================================

/**
 * Internal state for the mock Registry.
 *
 * Allows tests to inspect the registry state and verify which indexes
 * were written during store initialization.
 */
interface MockRegistryState {
    /** Current registered stores (mutated by save operations) */
    stores: StoreRegistry;
    /** Map of category path string → CategoryIndex written during initialization */
    writtenIndexes: Map<string, CategoryIndex>;
}

/**
 * Creates a mock Registry for testing initializeStore.
 *
 * The mock implements the Registry interface with in-memory storage,
 * tracking all registry mutations and index writes for assertion purposes.
 * By default, simulates a fresh (missing) registry that will be created
 * on first save.
 *
 * @param state - Initial state for stores and index tracking. Defaults to
 *   empty stores and no written indexes. Mutated by operations.
 * @param overrides - Optional partial overrides for Registry methods.
 *   Useful for simulating specific failure scenarios (e.g., failing
 *   index writes).
 * @returns A mock Registry instance suitable for initializeStore tests.
 *
 * @example Basic usage
 * ```typescript
 * const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
 * const registry = createMockRegistry(state);
 *
 * await initializeStore(registry, 'test', '/path');
 *
 * // Assert on state mutations
 * expect(state.stores['test']).toBeDefined();
 * expect(state.writtenIndexes.has('')).toBe(true); // root index
 * ```
 *
 * @example Simulating existing store
 * ```typescript
 * const state: MockRegistryState = {
 *   stores: { 'existing': { path: '/existing' } },
 *   writtenIndexes: new Map()
 * };
 * const registry = createMockRegistry(state);
 *
 * const result = await initializeStore(registry, 'existing', '/path');
 * expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
 * ```
 */
const createMockRegistry = (
    state: MockRegistryState = { stores: {}, writtenIndexes: new Map() },
    overrides: Partial<{
        load: Registry['load'];
        save: Registry['save'];
        getStore: Registry['getStore'];
    }> = {},
): Registry => {
    const defaultIndexStorage: IndexStorage = {
        read: mock(async () => ok(null)),
        write: mock(async (path: CategoryPath, contents: CategoryIndex) => {
            state.writtenIndexes.set(path.toString(), contents);
            return ok(undefined);
        }),
        reindex: mock(async () => ok({ warnings: [] })),
        updateAfterMemoryWrite: mock(async () => ok(undefined)),
    };

    const defaultMemoryStorage: MemoryStorage = {
        read: mock(async () => ok(null)),
        write: mock(async () => ok(undefined)),
        remove: mock(async () => ok(undefined)),
        move: mock(async () => ok(undefined)),
    };

    const defaultCategoryStorage: CategoryStorage = {
        exists: mock(async () => ok(false)),
        ensure: mock(async () => ok(undefined)),
        delete: mock(async () => ok(undefined)),
        updateSubcategoryDescription: mock(async () => ok(undefined)),
        removeSubcategoryEntry: mock(async () => ok(undefined)),
    };

    const defaultAdapter: ScopedStorageAdapter = {
        memories: defaultMemoryStorage,
        indexes: defaultIndexStorage,
        categories: defaultCategoryStorage,
    };

    return {
        initialize: mock(async () => ok(undefined)),
        load:
            overrides.load ??
            (async () => {
                if (Object.keys(state.stores).length === 0) {
                    // Return REGISTRY_MISSING to simulate fresh registry
                    return err({
                        code: 'REGISTRY_MISSING',
                        message: 'Registry not found',
                    } as RegistryError);
                }
                return ok(state.stores);
            }),
        save:
            overrides.save ??
            (async (registry: StoreRegistry) => {
                state.stores = registry;
                return ok(undefined);
            }),
        getStore:
            overrides.getStore ??
            ((name: string) => {
                if (!state.stores[name]) {
                    return err({
                        code: 'STORE_NOT_FOUND',
                        message: `Store '${name}' not found`,
                        store: name,
                    } as StoreNotFoundError);
                }
                return ok(defaultAdapter);
            }),
    };
};

// ============================================================================
// Tests
// ============================================================================

describe('initializeStore', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-init-store-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('root index creation', () => {
        it('should write root index using CategoryPath.root()', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'test-store';
            const storePath = join(tempDir, storeName);

            // Act
            const result = await initializeStore(registry, storeName, storePath);

            // Assert
            expect(result.ok()).toBe(true);

            // Verify root index was written (root = empty string key)
            expect(state.writtenIndexes.has('')).toBe(true);

            // Verify root index has correct structure
            const rootIndex = state.writtenIndexes.get('');
            expect(rootIndex).toBeDefined();
            expect(rootIndex!.memories).toEqual([]);
            expect(rootIndex!.subcategories).toEqual([]);
        });

        it('should create root index with empty arrays when no categories provided', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'empty-store';
            const storePath = join(tempDir, storeName);

            // Act
            const result = await initializeStore(registry, storeName, storePath);

            // Assert
            expect(result.ok()).toBe(true);

            const rootIndex = state.writtenIndexes.get('');
            expect(rootIndex).toBeDefined();
            expect(rootIndex!.memories).toHaveLength(0);
            expect(rootIndex!.subcategories).toHaveLength(0);
        });
    });

    describe('category index creation', () => {
        it('should write category indexes using CategoryPath.fromString()', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'cat-store';
            const storePath = join(tempDir, storeName);
            const categories = ['project', 'notes'];

            // Act
            const result = await initializeStore(registry, storeName, storePath, {
                categories,
            });

            // Assert
            expect(result.ok()).toBe(true);

            // Verify root index was written with subcategories
            expect(state.writtenIndexes.has('')).toBe(true);
            const rootIndex = state.writtenIndexes.get('');
            expect(rootIndex!.subcategories).toHaveLength(2);
            expect(rootIndex!.subcategories.map((s) => s.path.toString())).toContain('project');
            expect(rootIndex!.subcategories.map((s) => s.path.toString())).toContain('notes');

            // Verify category indexes were written
            expect(state.writtenIndexes.has('project')).toBe(true);
            expect(state.writtenIndexes.has('notes')).toBe(true);

            // Verify category indexes are empty
            const projectIndex = state.writtenIndexes.get('project');
            expect(projectIndex!.memories).toHaveLength(0);
            expect(projectIndex!.subcategories).toHaveLength(0);
        });

        it('should handle nested category paths', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'nested-store';
            const storePath = join(tempDir, storeName);
            const categories = ['project/cortex'];

            // Act
            const result = await initializeStore(registry, storeName, storePath, {
                categories,
            });

            // Assert
            expect(result.ok()).toBe(true);

            // Verify nested category index was written
            expect(state.writtenIndexes.has('project/cortex')).toBe(true);

            const nestedIndex = state.writtenIndexes.get('project/cortex');
            expect(nestedIndex!.memories).toHaveLength(0);
            expect(nestedIndex!.subcategories).toHaveLength(0);
        });
    });

    describe('registry integration', () => {
        it('should register store in registry', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'registered-store';
            const storePath = join(tempDir, storeName);

            // Act
            const result = await initializeStore(registry, storeName, storePath);

            // Assert
            expect(result.ok()).toBe(true);
            expect(state.stores[storeName]).toBeDefined();
            expect(state.stores[storeName]?.path).toBe(storePath);
        });

        it('should include description in registry when provided', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const storeName = 'desc-store';
            const storePath = join(tempDir, storeName);
            const description = 'A test store with description';

            // Act
            const result = await initializeStore(registry, storeName, storePath, {
                description,
            });

            // Assert
            expect(result.ok()).toBe(true);
            expect(state.stores[storeName]?.description).toBe(description);
        });
    });

    describe('error handling', () => {
        it('should reject invalid store names', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };
            const registry = createMockRegistry(state);
            const invalidStoreName = 'Invalid_Store_Name';
            const storePath = join(tempDir, 'invalid');

            // Act
            const result = await initializeStore(registry, invalidStoreName, storePath);

            // Assert
            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should reject duplicate store names', async () => {
            // Arrange - create a registry that already has the store
            const state: MockRegistryState = {
                stores: {
                    'existing-store': { path: '/existing/path' },
                },
                writtenIndexes: new Map(),
            };
            const registry = createMockRegistry(state);
            const storeName = 'existing-store';
            const storePath = join(tempDir, 'new-path');

            // Act
            const result = await initializeStore(registry, storeName, storePath);

            // Assert
            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
            }
        });

        it('should return error when index write fails', async () => {
            // Arrange
            const state: MockRegistryState = { stores: {}, writtenIndexes: new Map() };

            // Create mock that fails on index write
            const failingIndexStorage: IndexStorage = {
                read: async () => ok(null),
                write: async () =>
                    err({
                        code: 'IO_WRITE_ERROR' as const,
                        message: 'Simulated write failure',
                    }),
                reindex: async () => ok({ warnings: [] }),
                updateAfterMemoryWrite: async () => ok(undefined),
            };

            const registry = createMockRegistry(state, {
                getStore: (_name: string) =>
                    ok({
                        memories: {
                            read: async () => ok(null),
                            write: async () => ok(undefined),
                            remove: async () => ok(undefined),
                            move: async () => ok(undefined),
                        },
                        indexes: failingIndexStorage,
                        categories: {
                            exists: async () => ok(false),
                            ensure: async () => ok(undefined),
                            delete: async () => ok(undefined),
                            updateSubcategoryDescription: async () => ok(undefined),
                            removeSubcategoryEntry: async () => ok(undefined),
                        },
                    }),
            });
            const storeName = 'fail-store';
            const storePath = join(tempDir, storeName);

            // Act
            const result = await initializeStore(registry, storeName, storePath);

            // Assert
            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORE_INDEX_FAILED');
            }
        });
    });
});
