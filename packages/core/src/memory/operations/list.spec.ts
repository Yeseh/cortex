/**
 * Tests for listMemories operation.
 * @module core/memory/operations/list.spec
 */

import { describe, it, expect } from 'bun:test';
import { MemoryPath } from '@/memory/memory-path.ts';
import { listMemories } from './list.ts';
import {
    buildIndex,
    buildMemory,
    createMockStorage,
    memoryPathToString,
} from './test-helpers.spec.ts';
import { ok } from '@/result.ts';
import { CategoryPath } from '@/category/category-path.ts';

describe('listMemories', () => {
    it('should list memories in a category', async () => {
        // Index for the main category with 2 memories and 1 subcategory
        const mainIndex = buildIndex(
            [
                {
                    path: MemoryPath.fromString('project/test/memory1').unwrap(),
                    tokenEstimate: 100,
                },
                {
                    path: MemoryPath.fromString('project/test/memory2').unwrap(),
                    tokenEstimate: 150,
                },
            ],
            [{ path: CategoryPath.fromString('project/test/sub').unwrap(), memoryCount: 2 }],
        );
        // Empty index for the subcategory (no recursive collection wanted for this test)
        const subIndex = buildIndex([], []);

        const storage = createMockStorage({
            indexes: {
                load: async (path: CategoryPath) => {
                    if (path.toString() === 'project/test') return ok(mainIndex);
                    if (path.toString() === 'project/test/sub') return ok(subIndex);
                    return ok(null);
                },
            },
            memories: {
                load: async (memoryPath) => ok(buildMemory(memoryPathToString(memoryPath))),
            },
        });
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/test').unwrap(),
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category.toString()).toBe(
                CategoryPath.fromString('project/test').unwrap().toString(),
            );
            expect(result.value.memories.length).toBe(2);
            expect(result.value.subcategories.length).toBe(1);
            expect(result.value.subcategories[0]?.path.toString()).toBe(
                CategoryPath.fromString('project/test/sub').unwrap().toString(),
            );
        }
    });

    it('should return empty results for empty category', async () => {
        const storage = createMockStorage();
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/empty').unwrap(),
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories).toEqual([]);
            expect(result.value.subcategories).toEqual([]);
        }
    });

    it('should filter expired memories by default', async () => {
        const storage = createMockStorage({
            indexes: {
                load: async () =>
                    ok(
                        buildIndex(
                            [{
                                path: MemoryPath.fromString('project/test/expired').unwrap(),
                                tokenEstimate: 100,
                            }],
                            [],
                        ),
                    ),
            },
            memories: {
                load: async () =>
                    ok(buildMemory('project/test/expired', { expiresAt: new Date('2025-01-10T12:00:00.000Z') })),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/test').unwrap(),
            now,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories).toEqual([]);
        }
    });

    it('should include expired memories when includeExpired=true', async () => {
        const storage = createMockStorage({
            indexes: {
                load: async () =>
                    ok(
                        buildIndex(
                            [{
                                path: MemoryPath.fromString('project/test/expired').unwrap(),
                                tokenEstimate: 100,
                            }],
                            [],
                        ),
                    ),
            },
            memories: {
                load: async () =>
                    ok(buildMemory('project/test/expired', { expiresAt: new Date('2025-01-10T12:00:00.000Z') })),
            },
        });
        const now = new Date('2025-06-15T12:00:00Z');
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/test').unwrap(),
            includeExpired: true,
            now,
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.isExpired).toBe(true);
        }
    });

    it('should list root categories when no category specified', async () => {
        const rootIndex = buildIndex(
            [],
            [
                { path: CategoryPath.fromString('project').unwrap(), memoryCount: 0 },
                { path: CategoryPath.fromString('human').unwrap(), memoryCount: 0 },
            ],
        );

        const storage = createMockStorage({
            indexes: {
                load: async (name: CategoryPath) => {
                    if (name.toString() === '') return ok(rootIndex);
                    if (name.toString() === 'project') {
                        return ok(buildIndex([], []));
                    }
                    if (name.toString() === 'human') {
                        return ok(buildIndex([], []));
                    }
                    return ok(null);
                },
            },
        });
        const result = await listMemories(storage);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.category.toString()).toBe('');
            // Should list the discovered root categories
            expect(result.value.subcategories.length).toBe(2);
            expect(result.value.subcategories.map((s) => s.path.toString())).toContain('project');
            expect(result.value.subcategories.map((s) => s.path.toString())).toContain('human');
        }
    });

    it('should skip entries with invalid memory paths', async () => {
        const storage = createMockStorage({
            indexes: {
                load: async () =>
                    ok(
                        buildIndex(
                            [
                                {
                                    path: MemoryPath.fromString('project/test/valid').unwrap(),
                                    tokenEstimate: 100,
                                },
                                {
                                    path: MemoryPath.fromString('project/invalid path').unwrap(),
                                    tokenEstimate: 50,
                                },
                            ],
                            [],
                        ),
                    ),
            },
            memories: {
                load: async () => ok(buildMemory('project/test/valid')),
            },
        });
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/test').unwrap(),
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            // Should only include the valid memory, skipping invalid paths
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path.toString()).toBe('project/test/valid');
        }
    });

    it('should handle missing memory files gracefully', async () => {
        const storage = createMockStorage({
            indexes: {
                load: async () =>
                    ok(
                        buildIndex(
                            [
                                {
                                    path: MemoryPath.fromString('project/test/exists').unwrap(),
                                    tokenEstimate: 100,
                                },
                                {
                                    path: MemoryPath.fromString('project/test/missing').unwrap(),
                                    tokenEstimate: 50,
                                },
                            ],
                            [],
                        ),
                    ),
            },
            memories: {
                load: async (memoryPath: MemoryPath) => {
                    const path = memoryPathToString(memoryPath);
                    if (path === 'project/test/exists') {
                        return ok(buildMemory('project/test/exists'));
                    }
                    return ok(null);
                },
            },
        });
        const result = await listMemories(storage, {
            category: CategoryPath.fromString('project/test').unwrap(),
        });
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories.length).toBe(1);
            expect(result.value.memories[0]?.path.toString()).toBe('project/test/exists');
        }
    });
});
