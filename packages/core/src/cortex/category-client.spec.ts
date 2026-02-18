/**
 * Tests for the CategoryClient class.
 *
 * @module core/cortex/category-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { CategoryClient } from './category-client.ts';
import type { ScopedStorageAdapter, ReindexResult } from '@/storage/adapter.ts';
import type { Category, CategoryMemoryEntry, SubcategoryEntry } from '@/category/types.ts';
import { CategoryPath } from '@/category/category-path.ts';
import { MemoryPath } from '@/memory/memory-path.ts';
import { ok, err } from '@/result.ts';

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
// Path Normalization Tests
// =============================================================================

describe('CategoryClient', () => {
    describe('normalizePath (via constructor)', () => {
        it('should normalize root category path "/" to "/"', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/', adapter);
            expect(client.rawPath).toBe('/');
        });

        it('should normalize empty string to "/"', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('', adapter);
            expect(client.rawPath).toBe('/');
        });

        it('should normalize whitespace-only string to "/"', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('   ', adapter);
            expect(client.rawPath).toBe('/');
        });

        it('should add leading slash to path without one', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('standards', adapter);
            expect(client.rawPath).toBe('/standards');
        });

        it('should preserve leading slash when present', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/standards', adapter);
            expect(client.rawPath).toBe('/standards');
        });

        it('should remove trailing slash from non-root path', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('standards/', adapter);
            expect(client.rawPath).toBe('/standards');
        });

        it('should collapse multiple consecutive slashes to single slash', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('standards//javascript', adapter);
            expect(client.rawPath).toBe('/standards/javascript');
        });

        it('should handle multiple leading slashes', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('///standards', adapter);
            expect(client.rawPath).toBe('/standards');
        });

        it('should handle nested paths correctly', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('standards/typescript/formatting', adapter);
            expect(client.rawPath).toBe('/standards/typescript/formatting');
        });
    });

    // =========================================================================
    // parsePath() Tests
    // =========================================================================

    describe('parsePath()', () => {
        it('should return CategoryPath.root() for "/" path', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.isRoot).toBe(true);
                expect(result.value.toString()).toBe('');
            }
        });

        it('should parse single-segment path correctly', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/standards', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.isRoot).toBe(false);
                expect(result.value.toString()).toBe('standards');
            }
        });

        it('should parse multi-segment path correctly', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/standards/typescript', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('standards/typescript');
            }
        });

        it('should normalize path with special characters to empty slug', () => {
            const adapter = createMockAdapter();
            // Special characters are stripped during slug normalization
            // '!!!' normalizes to an empty slug which is still considered valid by CategoryPath
            const client = new CategoryClient('/!!!', adapter);

            const result = client.parsePath();

            // The path normalizes but results in an empty segment
            expect(result.ok()).toBe(true);
            if (result.ok()) {
                // Empty string segment after normalization
                expect(result.value.toString()).toBe('');
            }
        });
    });

    // =========================================================================
    // getCategory() Tests
    // =========================================================================

    describe('getCategory()', () => {
        it('should return subcategory with correct path from root', () => {
            const adapter = createMockAdapter();
            const root = new CategoryClient('/', adapter);

            const child = root.getCategory('standards');

            expect(child.rawPath).toBe('/standards');
        });

        it('should treat leading slash as relative path from root', () => {
            const adapter = createMockAdapter();
            const root = new CategoryClient('/', adapter);

            const child = root.getCategory('/standards');

            expect(child.rawPath).toBe('/standards');
        });

        it('should concatenate relative path from non-root category', () => {
            const adapter = createMockAdapter();
            const standards = new CategoryClient('/standards', adapter);

            const child = standards.getCategory('javascript');

            expect(child.rawPath).toBe('/standards/javascript');
        });

        it('should handle deep relative paths', () => {
            const adapter = createMockAdapter();
            const root = new CategoryClient('/', adapter);

            const deep = root.getCategory('a/b/c');

            expect(deep.rawPath).toBe('/a/b/c');
        });

        it('should return self when relative path is empty', () => {
            const adapter = createMockAdapter();
            const category = new CategoryClient('/standards', adapter);

            const same = category.getCategory('');

            expect(same.rawPath).toBe('/standards');
        });

        it('should return self when relative path is whitespace', () => {
            const adapter = createMockAdapter();
            const category = new CategoryClient('/standards', adapter);

            const same = category.getCategory('   ');

            expect(same.rawPath).toBe('/standards');
        });

        it('should strip multiple leading slashes from relative path', () => {
            const adapter = createMockAdapter();
            const root = new CategoryClient('/', adapter);

            const child = root.getCategory('///foo');

            expect(child.rawPath).toBe('/foo');
        });
    });

    // =========================================================================
    // parent() Tests
    // =========================================================================

    describe('parent()', () => {
        it('should return null for root category', () => {
            const adapter = createMockAdapter();
            const root = new CategoryClient('/', adapter);

            const parent = root.parent();

            expect(parent).toBeNull();
        });

        it('should return root for depth-1 category', () => {
            const adapter = createMockAdapter();
            const category = new CategoryClient('/standards', adapter);

            const parent = category.parent();

            expect(parent).not.toBeNull();
            expect(parent!.rawPath).toBe('/');
        });

        it('should return parent path for nested category', () => {
            const adapter = createMockAdapter();
            const category = new CategoryClient('/standards/javascript', adapter);

            const parent = category.parent();

            expect(parent).not.toBeNull();
            expect(parent!.rawPath).toBe('/standards');
        });

        it('should enable chain navigation to root', () => {
            const adapter = createMockAdapter();
            const category = new CategoryClient('/a/b/c', adapter);

            const parent1 = category.parent();
            expect(parent1!.rawPath).toBe('/a/b');

            const parent2 = parent1!.parent();
            expect(parent2!.rawPath).toBe('/a');

            const parent3 = parent2!.parent();
            expect(parent3!.rawPath).toBe('/');

            const parent4 = parent3!.parent();
            expect(parent4).toBeNull();
        });
    });

    // =========================================================================
    // exists() Tests
    // =========================================================================

    describe('exists()', () => {
        it('should return true when category exists', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async (path) => {
                        if (path.toString() === 'standards') {
                            return ok(true);
                        }
                        return ok(false);
                    },
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false when category does not exist', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(false),
                },
            });
            const client = new CategoryClient('/nonexistent', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(false);
            }
        });

        it('should handle normalized special character path on exists check', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(false),
                },
            });
            // Special characters normalize to empty string which is still valid
            const client = new CategoryClient('/!!!', adapter);

            const result = await client.exists();

            // Path is normalized, so exists should work (but return false)
            expect(result.ok()).toBe(true);
        });

        it('should call exists with correct CategoryPath for root', async () => {
            let calledPath: CategoryPath | null = null;
            const adapter = createMockAdapter({
                categories: {
                    exists: async (path) => {
                        calledPath = path;
                        return ok(true);
                    },
                },
            });
            const client = new CategoryClient('/', adapter);

            await client.exists();

            expect(calledPath).not.toBeNull();
            expect(calledPath!.isRoot).toBe(true);
        });
    });

    // =========================================================================
    // create() Tests
    // =========================================================================

    describe('create()', () => {
        it('should create category and return result with created: true', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(false),
                    ensure: async () => ok(undefined),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.create();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.path).toBe('standards');
                expect(result.value.created).toBe(true);
            }
        });

        it('should return created: false when category already exists', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(true),
                    ensure: async () => ok(undefined),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.create();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.created).toBe(false);
            }
        });

        it('should return INVALID_PATH error when creating root category', async () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/', adapter);

            const result = await client.create();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should return INVALID_PATH error for invalid path', async () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/!!!', adapter);

            const result = await client.create();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });
    });

    // =========================================================================
    // delete() Tests
    // =========================================================================

    describe('delete()', () => {
        it('should delete category and return result', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(true),
                    delete: async () => ok(undefined),
                    removeSubcategoryEntry: async () => ok(undefined),
                },
            });
            // Use a nested path since root categories (depth=1) cannot be deleted
            const client = new CategoryClient('/standards/typescript', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.path).toBe('standards/typescript');
                expect(result.value.deleted).toBe(true);
            }
        });

        it('should return CATEGORY_NOT_FOUND error when category does not exist', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(false),
                },
            });
            // Use nested path to avoid ROOT_CATEGORY_REJECTED
            const client = new CategoryClient('/standards/nonexistent', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
            }
        });

        it('should return ROOT_CATEGORY_REJECTED error when deleting root-level category', async () => {
            const adapter = createMockAdapter();
            // Root-level categories (depth=1) cannot be deleted
            const client = new CategoryClient('/standards', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('ROOT_CATEGORY_REJECTED');
            }
        });

        it('should return CATEGORY_NOT_FOUND error when deleting root', async () => {
            // Note: Root path (depth 0) passes through the ROOT_CATEGORY_REJECTED check
            // and hits the exists check, which returns false by default
            const adapter = createMockAdapter();
            const client = new CategoryClient('/', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                // Root gets CATEGORY_NOT_FOUND because exists returns false
                expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
            }
        });
    });

    // =========================================================================
    // setDescription() Tests
    // =========================================================================

    describe('setDescription()', () => {
        it('should set description successfully', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(true),
                    updateSubcategoryDescription: async () => ok(undefined),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.setDescription('TypeScript coding standards');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.path).toBe('standards');
                expect(result.value.description).toBe('TypeScript coding standards');
            }
        });

        it('should clear description when passed null', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(true),
                    updateSubcategoryDescription: async () => ok(undefined),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.setDescription(null);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.description).toBeNull();
            }
        });

        it('should clear description when passed empty string', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(true),
                    updateSubcategoryDescription: async () => ok(undefined),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.setDescription('');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.description).toBeNull();
            }
        });

        it('should return CATEGORY_NOT_FOUND error when category does not exist', async () => {
            const adapter = createMockAdapter({
                categories: {
                    exists: async () => ok(false),
                },
            });
            const client = new CategoryClient('/nonexistent', adapter);

            const result = await client.setDescription('test');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
            }
        });
    });

    // =========================================================================
    // listMemories() Tests
    // =========================================================================

    describe('listMemories()', () => {
        it('should return empty array when no index exists', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok(null),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listMemories();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toEqual([]);
            }
        });

        it('should return memories from index', async () => {
            const memoryPath = MemoryPath.fromString('standards/architecture').value as MemoryPath;
            const memories: CategoryMemoryEntry[] = [{ path: memoryPath, tokenEstimate: 150 }];
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories,
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listMemories();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.length).toBe(1);
                expect(result.value[0]!.tokenEstimate).toBe(150);
            }
        });

        it('should return all memories without filtering', async () => {
            // Expiration filtering is NOT done in listMemories() - it happens via prune()
            // This test verifies listMemories() returns all memories regardless of updatedAt
            const now = new Date();
            const pastDate = new Date(now.getTime() - 86400000); // 1 day ago
            const futureDate = new Date(now.getTime() + 86400000); // 1 day from now

            const memoryPath1 = MemoryPath.fromString('standards/old').value as MemoryPath;
            const memoryPath2 = MemoryPath.fromString('standards/new').value as MemoryPath;

            const memories: CategoryMemoryEntry[] = [
                { path: memoryPath1, tokenEstimate: 100, updatedAt: pastDate },
                { path: memoryPath2, tokenEstimate: 200, updatedAt: futureDate },
            ];

            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories,
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listMemories();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                // Both memories should be returned - no filtering
                expect(result.value.length).toBe(2);
                expect(result.value[0]!.tokenEstimate).toBe(100);
                expect(result.value[1]!.tokenEstimate).toBe(200);
            }
        });

        it('should return same results regardless of includeExpired option', async () => {
            // includeExpired is reserved for future use - currently has no effect
            // Expiration filtering happens via prune(), not listMemories()
            const now = new Date();
            const pastDate = new Date(now.getTime() - 86400000); // 1 day ago

            const memoryPath = MemoryPath.fromString('standards/expired').value as MemoryPath;
            const memories: CategoryMemoryEntry[] = [{ path: memoryPath, tokenEstimate: 100, updatedAt: pastDate }];

            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories,
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const resultWithOption = await client.listMemories({ includeExpired: true });
            const resultWithoutOption = await client.listMemories();

            expect(resultWithOption.ok()).toBe(true);
            expect(resultWithoutOption.ok()).toBe(true);
            if (resultWithOption.ok() && resultWithoutOption.ok()) {
                expect(resultWithOption.value.length).toBe(1);
                expect(resultWithoutOption.value.length).toBe(1);
                // Both should return the same memories
                expect(resultWithOption.value).toEqual(resultWithoutOption.value);
            }
        });

        it('should return STORAGE_ERROR when index read fails', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => err({
                        code: 'IO_READ_ERROR',
                        message: 'Failed to read index',
                    }),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listMemories();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });

        it('should handle normalized special character path', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok(null),
                },
            });
            // Special characters are normalized, so this becomes a valid (though empty) path
            const client = new CategoryClient('/!!!', adapter);

            const result = await client.listMemories();

            // Path is normalized, returns empty array since no index
            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toEqual([]);
            }
        });
    });

    // =========================================================================
    // listSubcategories() Tests
    // =========================================================================

    describe('listSubcategories()', () => {
        it('should return empty array when no index exists', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok(null),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listSubcategories();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toEqual([]);
            }
        });

        it('should return subcategories from index', async () => {
            const subcategoryPath = CategoryPath.fromString('standards/typescript').value as CategoryPath;
            const subcategories: SubcategoryEntry[] = [{ path: subcategoryPath, memoryCount: 5, description: 'TypeScript standards' }];
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories: [],
                        subcategories,
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listSubcategories();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.length).toBe(1);
                expect(result.value[0]!.memoryCount).toBe(5);
                expect(result.value[0]!.description).toBe('TypeScript standards');
            }
        });

        it('should return STORAGE_ERROR when index read fails', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => err({
                        code: 'IO_READ_ERROR',
                        message: 'Failed to read index',
                    }),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.listSubcategories();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });

        it('should handle normalized special character path', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok(null),
                },
            });
            // Special characters are normalized
            const client = new CategoryClient('/!!!', adapter);

            const result = await client.listSubcategories();

            // Path is normalized, returns empty array since no index
            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toEqual([]);
            }
        });
    });

    // =========================================================================
    // reindex() Tests
    // =========================================================================

    describe('reindex()', () => {
        it('should call adapter.indexes.reindex and return result', async () => {
            const expectedResult: ReindexResult = { warnings: ['some warning'] };
            const adapter = createMockAdapter({
                indexes: {
                    reindex: async () => ok(expectedResult),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.reindex();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.warnings).toEqual(['some warning']);
            }
        });

        it('should return empty warnings array on successful reindex', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.reindex();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.warnings).toEqual([]);
            }
        });

        it('should return STORAGE_ERROR when reindex fails', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    reindex: async () => err({
                        code: 'INDEX_ERROR',
                        message: 'Failed to reindex',
                    }),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.reindex();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
                expect(result.error.message).toContain('Failed to reindex');
            }
        });

        it('should work from root category', async () => {
            let reindexCalled = false;
            const adapter = createMockAdapter({
                indexes: {
                    reindex: async () => {
                        reindexCalled = true;
                        return ok({ warnings: [] });
                    },
                },
            });
            const client = new CategoryClient('/', adapter);

            const result = await client.reindex();

            expect(result.ok()).toBe(true);
            expect(reindexCalled).toBe(true);
        });
    });

    // =========================================================================
    // prune() Tests
    // =========================================================================

    describe('prune()', () => {
        it('should return empty pruned array when no expired memories', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories: [],
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.prune();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.pruned).toEqual([]);
            }
        });

        it('should support dryRun option', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories: [],
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.prune({ dryRun: true });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.pruned).toEqual([]);
            }
        });

        it('should return STORAGE_ERROR when prune fails', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => err({
                        code: 'IO_READ_ERROR',
                        message: 'Failed to read index',
                    }),
                },
            });
            const client = new CategoryClient('/standards', adapter);

            const result = await client.prune();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });

        it('should handle normalized special character path', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories: [],
                        subcategories: [],
                    } as Category),
                },
            });
            // Special characters are normalized
            const client = new CategoryClient('/!!!', adapter);

            const result = await client.prune();

            expect(result.ok()).toBe(true);
        });

        it('should work from root category', async () => {
            const adapter = createMockAdapter({
                indexes: {
                    read: async () => ok({
                        memories: [],
                        subcategories: [],
                    } as Category),
                },
            });
            const client = new CategoryClient('/', adapter);

            const result = await client.prune();

            expect(result.ok()).toBe(true);
        });
    });

    // =========================================================================
    // getMemory() Tests
    // =========================================================================

    describe('getMemory()', () => {
        it('should return NOT_IMPLEMENTED error', () => {
            const adapter = createMockAdapter();
            const client = new CategoryClient('/standards', adapter);

            const result = client.getMemory('test');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('NOT_IMPLEMENTED');
            }
        });
    });
});
