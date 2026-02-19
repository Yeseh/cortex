/**
 * Tests for the MemoryClient class.
 *
 * @module core/cortex/memory-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { MemoryClient } from './memory-client.ts';
import { CategoryClient } from './category-client.ts';
import type { ScopedStorageAdapter, ReindexResult } from '@/storage/adapter.ts';
import { MemoryPath } from '@/memory/memory-path.ts';
import { Memory, type MemoryMetadata } from '@/memory/memory.ts';
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
        reindex: async () => ok({ warnings: [] } as ReindexResult),
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
// Memory Fixture Builder
// =============================================================================

const buildMemoryFixture = (
    path: string,
    overrides: Partial<MemoryMetadata> = {},
    content = 'Sample memory content',
): Memory => {
    const timestamp = new Date('2025-01-15T12:00:00.000Z');
    const metadata: MemoryMetadata = {
        createdAt: timestamp,
        updatedAt: timestamp,
        tags: [
            'test', 'sample',
        ],
        source: 'test',
        expiresAt: undefined,
        citations: [],
        ...overrides,
    };

    const result = Memory.init(path, metadata, content);
    if (!result.ok()) {
        throw new Error(`Test setup failed to create memory: ${result.error.message}`);
    }

    return result.value;
};

// =============================================================================
// Constructor and Properties Tests
// =============================================================================

describe('MemoryClient', () => {
    describe('properties', () => {
        it('should have correct rawPath after construction', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);
            expect(client.rawPath).toBe('/standards/typescript/style');
        });

        it('should have correct rawSlug after construction', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);
            expect(client.rawSlug).toBe('style');
        });

        it('should normalize path with leading slash', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('standards/typescript/style', 'style', adapter);
            expect(client.rawPath).toBe('/standards/typescript/style');
        });

        it('should collapse multiple slashes', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('//standards//typescript//style', 'style', adapter);
            expect(client.rawPath).toBe('/standards/typescript/style');
        });

        it('should remove trailing slash', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/style/', 'style', adapter);
            expect(client.rawPath).toBe('/standards/typescript/style');
        });
    });

    // =========================================================================
    // parsePath() Tests
    // =========================================================================

    describe('parsePath', () => {
        it('should return valid MemoryPath for valid path', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('standards/typescript/style');
                expect(result.value.category.toString()).toBe('standards/typescript');
                expect(result.value.slug.toString()).toBe('style');
            }
        });

        it('should return INVALID_PATH error for path with single segment', () => {
            const adapter = createMockAdapter();
            // A single segment path is invalid for MemoryPath (needs category/slug)
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should handle path segments correctly', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/a/b/c/d/e', 'e', adapter);

            const result = client.parsePath();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('a/b/c/d/e');
                expect(result.value.category.toString()).toBe('a/b/c/d');
                expect(result.value.slug.toString()).toBe('e');
            }
        });
    });

    // =========================================================================
    // parseSlug() Tests
    // =========================================================================

    describe('parseSlug', () => {
        it('should return valid Slug for valid slug', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = client.parseSlug();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('style');
            }
        });

        it('should return INVALID_PATH error for empty slug', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/', '', adapter);

            const result = client.parseSlug();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should normalize slug with uppercase to lowercase', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/MyStyle', 'MyStyle', adapter);

            const result = client.parseSlug();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('mystyle');
            }
        });

        it('should normalize slug with spaces to hyphens', () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/standards/typescript/my style', 'my style', adapter);

            const result = client.parseSlug();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('my-style');
            }
        });
    });

    // =========================================================================
    // Lazy Validation Tests
    // =========================================================================

    describe('lazy validation', () => {
        it('should not error on construction with invalid slug', () => {
            const adapter = createMockAdapter();
            // Construction succeeds even with invalid slug
            const client = MemoryClient.create('/invalid', '', adapter);
            expect(client).toBeInstanceOf(MemoryClient);
        });

        it('should error with INVALID_PATH on get() with invalid path', async () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await client.get();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should error with INVALID_PATH on create() with invalid path', async () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await client.create({
                content: 'Test content',
                source: 'test',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should error with INVALID_PATH on update() with invalid path', async () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await client.update({
                content: 'Updated content',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should error with INVALID_PATH on delete() with invalid path', async () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should error with INVALID_PATH on exists() with invalid path', async () => {
            const adapter = createMockAdapter();
            const client = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });
    });

    // =========================================================================
    // Lifecycle Method Tests: create()
    // =========================================================================

    describe('create', () => {
        it('should create memory and return Memory', async () => {
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
                indexes: {
                    updateAfterMemoryWrite: async () => ok(undefined),
                },
                categories: {
                    exists: async () => ok(true),
                },
            });
            const client = MemoryClient.create('/standards/typescript/architecture', 'architecture', adapter);

            const result = await client.create({
                content: '# Architecture Notes',
                source: 'user',
                tags: [
                    'architecture', 'typescript',
                ],
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.path.toString()).toBe('standards/typescript/architecture');
                expect(result.value.content).toBe('# Architecture Notes');
                expect(result.value.metadata.tags).toEqual([
                    'architecture', 'typescript',
                ]);
                expect(result.value.metadata.source).toBe('user');
            }
            expect(writtenMemory).toBeDefined();
        });

        it('should create memory with expiration', async () => {
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
                categories: {
                    exists: async () => ok(true),
                },
            });
            const client = MemoryClient.create('/standards/typescript/temp', 'temp', adapter);
            const expiresAt = new Date('2030-01-01T00:00:00Z');

            const result = await client.create({
                content: 'Temporary notes',
                source: 'user',
                expiresAt,
            });

            expect(result.ok()).toBe(true);
            expect(writtenMemory?.metadata.expiresAt).toEqual(expiresAt);
        });

        it('should create memory with citations', async () => {
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
                categories: {
                    exists: async () => ok(true),
                },
            });
            const client = MemoryClient.create('/standards/typescript/decision', 'decision', adapter);

            const result = await client.create({
                content: 'Architecture decision',
                source: 'user',
                citations: [
                    'docs/adr-001.md', 'https://example.com/spec',
                ],
            });

            expect(result.ok()).toBe(true);
            expect(writtenMemory?.metadata.citations).toEqual([
                'docs/adr-001.md',
                'https://example.com/spec',
            ]);
        });

        it('should return STORAGE_ERROR when write fails', async () => {
            const adapter = createMockAdapter({
                memories: {
                    write: async () => err({
                        code: 'IO_WRITE_ERROR',
                        message: 'Disk full',
                    }),
                },
                categories: {
                    exists: async () => ok(true),
                },
            });
            const client = MemoryClient.create('/standards/typescript/test', 'test', adapter);

            const result = await client.create({
                content: 'Test',
                source: 'test',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });

        it('should return STORAGE_ERROR when index update fails', async () => {
            const adapter = createMockAdapter({
                memories: {
                    write: async () => ok(undefined),
                },
                indexes: {
                    updateAfterMemoryWrite: async () => err({
                        code: 'INDEX_ERROR',
                        message: 'Index corruption',
                    }),
                },
                categories: {
                    exists: async () => ok(true),
                },
            });
            const client = MemoryClient.create('/standards/typescript/test', 'test', adapter);

            const result = await client.create({
                content: 'Test',
                source: 'test',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
                expect(result.error.message).toContain('index');
            }
        });
    });

    // =========================================================================
    // Lifecycle Method Tests: get()
    // =========================================================================

    describe('get', () => {
        it('should return memory content', async () => {
            const memory = buildMemoryFixture('standards/typescript/style', {}, 'Code style guide');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(memory),
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.get();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Code style guide');
                expect(result.value.path.toString()).toBe('standards/typescript/style');
            }
        });

        it('should return MEMORY_NOT_FOUND for non-existent memory', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(null),
                },
            });
            const client = MemoryClient.create('/standards/typescript/nonexistent', 'nonexistent', adapter);

            const result = await client.get();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            }
        });

        it('should return MEMORY_EXPIRED for expired memory', async () => {
            const expiredMemory = buildMemoryFixture('standards/typescript/old', {
                expiresAt: new Date('2020-01-01T00:00:00Z'),
            }, 'Expired content');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(expiredMemory),
                },
            });
            const client = MemoryClient.create('/standards/typescript/old', 'old', adapter);

            const result = await client.get();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MEMORY_EXPIRED');
            }
        });

        it('should return expired memory with includeExpired option', async () => {
            const expiredMemory = buildMemoryFixture('standards/typescript/old', {
                expiresAt: new Date('2020-01-01T00:00:00Z'),
            }, 'Expired content');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(expiredMemory),
                },
            });
            const client = MemoryClient.create('/standards/typescript/old', 'old', adapter);

            const result = await client.get({ includeExpired: true });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Expired content');
            }
        });

        it('should return STORAGE_ERROR when read fails', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => err({
                        code: 'IO_READ_ERROR',
                        message: 'Permission denied',
                    }),
                },
            });
            const client = MemoryClient.create('/standards/typescript/test', 'test', adapter);

            const result = await client.get();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });
    });

    // =========================================================================
    // Lifecycle Method Tests: update()
    // =========================================================================

    describe('update', () => {
        it('should update memory content', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {}, 'Old content');
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
                indexes: {
                    updateAfterMemoryWrite: async () => ok(undefined),
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.update({
                content: 'New content',
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('New content');
            }
            expect(writtenMemory?.content).toBe('New content');
        });

        it('should update memory tags', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {
                tags: ['old-tag'],
            }, 'Content');
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.update({
                tags: [
                    'new-tag', 'updated',
                ],
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.metadata.tags).toEqual([
                    'new-tag', 'updated',
                ]);
            }
            expect(writtenMemory?.metadata.tags).toEqual([
                'new-tag', 'updated',
            ]);
        });

        it('should clear expiration with null', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {
                expiresAt: new Date('2030-01-01T00:00:00Z'),
            }, 'Content');
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.update({
                expiresAt: null,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.metadata.expiresAt).toBeUndefined();
            }
            expect(writtenMemory?.metadata.expiresAt).toBeUndefined();
        });

        it('should update citations', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {
                citations: ['old.md'],
            }, 'Content');
            let writtenMemory: Memory | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    write: async (memory) => {
                        writtenMemory = memory;
                        return ok(undefined);
                    },
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.update({
                citations: [
                    'new.md', 'https://example.com',
                ],
            });

            expect(result.ok()).toBe(true);
            expect(writtenMemory?.metadata.citations).toEqual([
                'new.md', 'https://example.com',
            ]);
        });

        it('should return MEMORY_NOT_FOUND for non-existent memory', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(null),
                },
            });
            const client = MemoryClient.create('/standards/typescript/nonexistent', 'nonexistent', adapter);

            const result = await client.update({
                content: 'New content',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            }
        });

        it('should return INVALID_INPUT when no updates provided', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.update({});

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_INPUT');
            }
        });
    });

    // =========================================================================
    // Lifecycle Method Tests: delete()
    // =========================================================================

    describe('delete', () => {
        it('should delete existing memory', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/old', {}, 'Old content');
            let removeCalled = false;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    remove: async () => {
                        removeCalled = true;
                        return ok(undefined);
                    },
                },
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });
            const client = MemoryClient.create('/standards/typescript/old', 'old', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(true);
            expect(removeCalled).toBe(true);
        });

        it('should return MEMORY_NOT_FOUND for non-existent memory', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(null),
                },
            });
            const client = MemoryClient.create('/standards/typescript/nonexistent', 'nonexistent', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            }
        });

        it('should return STORAGE_ERROR when remove fails', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/old', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    remove: async () => err({
                        code: 'IO_WRITE_ERROR',
                        message: 'Permission denied',
                    }),
                },
            });
            const client = MemoryClient.create('/standards/typescript/old', 'old', adapter);

            const result = await client.delete();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });
    });

    // =========================================================================
    // Lifecycle Method Tests: exists()
    // =========================================================================

    describe('exists', () => {
        it('should return true for existing memory', async () => {
            const existingMemory = buildMemoryFixture('standards/typescript/style', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                },
            });
            const client = MemoryClient.create('/standards/typescript/style', 'style', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(true);
            }
        });

        it('should return false for non-existent memory', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(null),
                },
            });
            const client = MemoryClient.create('/standards/typescript/nonexistent', 'nonexistent', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(false);
            }
        });

        it('should return STORAGE_ERROR when read fails', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => err({
                        code: 'IO_READ_ERROR',
                        message: 'Connection error',
                    }),
                },
            });
            const client = MemoryClient.create('/standards/typescript/test', 'test', adapter);

            const result = await client.exists();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORAGE_ERROR');
            }
        });
    });

    // =========================================================================
    // Move Tests
    // =========================================================================

    describe('move', () => {
        it('should move memory to MemoryClient destination', async () => {
            const existingMemory = buildMemoryFixture('standards/old/style', {}, 'Content');
            let movedFrom: MemoryPath | undefined;
            let movedTo: MemoryPath | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        // Source exists, destination doesn't
                        if (path.toString() === 'standards/old/style') {
                            return ok(existingMemory);
                        }
                        return ok(null);
                    },
                    move: async (from, to) => {
                        movedFrom = from;
                        movedTo = to;
                        return ok(undefined);
                    },
                },
                categories: {
                    ensure: async () => ok(undefined),
                },
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });

            const sourceClient = MemoryClient.create('/standards/old/style', 'style', adapter);
            const destClient = MemoryClient.create('/standards/new/style', 'style', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.rawPath).toBe('/standards/new/style');
                expect(result.value.rawSlug).toBe('style');
            }
            expect(movedFrom?.toString()).toBe('standards/old/style');
            expect(movedTo?.toString()).toBe('standards/new/style');
        });

        it('should move memory to MemoryPath destination', async () => {
            const existingMemory = buildMemoryFixture('standards/old/style', {}, 'Content');
            let movedTo: MemoryPath | undefined;
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        if (path.toString() === 'standards/old/style') {
                            return ok(existingMemory);
                        }
                        return ok(null);
                    },
                    move: async (_from, to) => {
                        movedTo = to;
                        return ok(undefined);
                    },
                },
                categories: {
                    ensure: async () => ok(undefined),
                },
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });

            const sourceClient = MemoryClient.create('/standards/old/style', 'style', adapter);
            const destPath = MemoryPath.fromString('standards/new/format').value as MemoryPath;

            const result = await sourceClient.move(destPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.rawPath).toBe('/standards/new/format');
                expect(result.value.rawSlug).toBe('format');
            }
            expect(movedTo?.toString()).toBe('standards/new/format');
        });

        it('should return new client with correct rawPath', async () => {
            const existingMemory = buildMemoryFixture('old/category/memory', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        if (path.toString() === 'old/category/memory') {
                            return ok(existingMemory);
                        }
                        return ok(null);
                    },
                    move: async () => ok(undefined),
                },
                categories: {
                    ensure: async () => ok(undefined),
                },
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });

            const sourceClient = MemoryClient.create('/old/category/memory', 'memory', adapter);
            const destClient = MemoryClient.create('/new/category/memory', 'memory', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.rawPath).toBe('/new/category/memory');
            }
        });

        it('should preserve source client rawPath after move', async () => {
            const existingMemory = buildMemoryFixture('old/category/memory', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        if (path.toString() === 'old/category/memory') {
                            return ok(existingMemory);
                        }
                        return ok(null);
                    },
                    move: async () => ok(undefined),
                },
                categories: {
                    ensure: async () => ok(undefined),
                },
                indexes: {
                    reindex: async () => ok({ warnings: [] }),
                },
            });

            const sourceClient = MemoryClient.create('/old/category/memory', 'memory', adapter);
            const destClient = MemoryClient.create('/new/category/memory', 'memory', adapter);

            await sourceClient.move(destClient);

            // Source client rawPath is unchanged (though it's stale)
            expect(sourceClient.rawPath).toBe('/old/category/memory');
        });

        it('should return MEMORY_NOT_FOUND for non-existent source', async () => {
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(null),
                },
            });

            const sourceClient = MemoryClient.create('/nonexistent/category/memory', 'memory', adapter);
            const destClient = MemoryClient.create('/new/category/memory', 'memory', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            }
        });

        it('should return DESTINATION_EXISTS if destination exists', async () => {
            const existingMemory = buildMemoryFixture('old/category/memory', {}, 'Content');
            const destMemory = buildMemoryFixture('new/category/memory', {}, 'Existing');
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        if (path.toString() === 'old/category/memory') {
                            return ok(existingMemory);
                        }
                        if (path.toString() === 'new/category/memory') {
                            return ok(destMemory);
                        }
                        return ok(null);
                    },
                },
            });

            const sourceClient = MemoryClient.create('/old/category/memory', 'memory', adapter);
            const destClient = MemoryClient.create('/new/category/memory', 'memory', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('DESTINATION_EXISTS');
            }
        });

        it('should handle same-path move as no-op', async () => {
            const existingMemory = buildMemoryFixture('old/category/memory', {}, 'Content');
            let moveCalled = false;
            const adapter = createMockAdapter({
                memories: {
                    read: async () => ok(existingMemory),
                    move: async () => {
                        moveCalled = true;
                        return ok(undefined);
                    },
                },
            });

            const sourceClient = MemoryClient.create('/old/category/memory', 'memory', adapter);
            // Same path - this should be a no-op
            const destClient = MemoryClient.create('/old/category/memory', 'memory', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.rawPath).toBe('/old/category/memory');
            }
            // Move should not have been called for same-path
            expect(moveCalled).toBe(false);
        });

        it('should return INVALID_PATH for invalid source path', async () => {
            const adapter = createMockAdapter();
            const sourceClient = MemoryClient.create('/invalid', 'invalid', adapter);
            const destClient = MemoryClient.create('/valid/category/memory', 'memory', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });

        it('should return INVALID_PATH for invalid destination path', async () => {
            const existingMemory = buildMemoryFixture('valid/category/memory', {}, 'Content');
            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        if (path.toString() === 'valid/category/memory') {
                            return ok(existingMemory);
                        }
                        return ok(null);
                    },
                },
            });

            const sourceClient = MemoryClient.create('/valid/category/memory', 'memory', adapter);
            const destClient = MemoryClient.create('/invalid', 'invalid', adapter);

            const result = await sourceClient.move(destClient);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });
    });

    // =========================================================================
    // Integration Tests with CategoryClient
    // =========================================================================

    describe('integration', () => {
        it('should work with CategoryClient.getMemory()', () => {
            const adapter = createMockAdapter();
            const category = CategoryClient.create('/standards/typescript', adapter);

            const memoryClient = category.getMemory('style');

            expect(memoryClient).toBeInstanceOf(MemoryClient);
            expect(memoryClient.rawPath).toBe('/standards/typescript/style');
            expect(memoryClient.rawSlug).toBe('style');
        });

        it('should work with CategoryClient.getMemory() from root', () => {
            const adapter = createMockAdapter();
            const root = CategoryClient.create('/', adapter);
            const standards = root.getCategory('standards');
            const typescript = standards.getCategory('typescript');

            const memoryClient = typescript.getMemory('architecture');

            expect(memoryClient.rawPath).toBe('/standards/typescript/architecture');
            expect(memoryClient.rawSlug).toBe('architecture');
        });

        it('should support full create-get-update-delete flow', async () => {
            // Use a stateful mock that remembers what's been created
            const memories = new Map<string, Memory>();

            const adapter = createMockAdapter({
                memories: {
                    read: async (path) => {
                        const key = path.toString();
                        return ok(memories.get(key) ?? null);
                    },
                    write: async (memory) => {
                        const key = memory.path.toString();
                        memories.set(key, memory);
                        return ok(undefined);
                    },
                    remove: async (path) => {
                        const key = path.toString();
                        memories.delete(key);
                        return ok(undefined);
                    },
                },
                indexes: {
                    updateAfterMemoryWrite: async () => ok(undefined),
                    reindex: async () => ok({ warnings: [] }),
                },
                categories: {
                    exists: async () => ok(true),
                },
            });

            const client = MemoryClient.create('/standards/typescript/test', 'test', adapter);

            // Create
            const createResult = await client.create({
                content: 'Initial content',
                source: 'test',
                tags: ['v1'],
            });
            expect(createResult.ok()).toBe(true);

            // Verify exists
            const existsAfterCreate = await client.exists();
            expect(existsAfterCreate.ok()).toBe(true);
            if (existsAfterCreate.ok()) {
                expect(existsAfterCreate.value).toBe(true);
            }

            // Get
            const getResult = await client.get();
            expect(getResult.ok()).toBe(true);
            if (getResult.ok()) {
                expect(getResult.value.content).toBe('Initial content');
                expect(getResult.value.metadata.tags).toEqual(['v1']);
            }

            // Update
            const updateResult = await client.update({
                content: 'Updated content',
                tags: [
                    'v2', 'updated',
                ],
            });
            expect(updateResult.ok()).toBe(true);
            if (updateResult.ok()) {
                expect(updateResult.value.content).toBe('Updated content');
                expect(updateResult.value.metadata.tags).toEqual([
                    'v2', 'updated',
                ]);
            }

            // Verify update
            const getAfterUpdate = await client.get();
            expect(getAfterUpdate.ok()).toBe(true);
            if (getAfterUpdate.ok()) {
                expect(getAfterUpdate.value.content).toBe('Updated content');
            }

            // Delete
            const deleteResult = await client.delete();
            expect(deleteResult.ok()).toBe(true);

            // Verify deletion
            const existsAfterDelete = await client.exists();
            expect(existsAfterDelete.ok()).toBe(true);
            if (existsAfterDelete.ok()) {
                expect(existsAfterDelete.value).toBe(false);
            }
        });

        it('should fail with INVALID_PATH when memory is created directly under root', async () => {
            const adapter = createMockAdapter();
            const root = CategoryClient.create('/', adapter);
            const memory = root.getMemory('orphan-memory');

            // Path is /orphan-memory which is only 1 segment, needs at least 2
            const result = await memory.exists();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_PATH');
            }
        });
    });
});
