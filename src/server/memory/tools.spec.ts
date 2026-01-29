/**
 * Unit tests for MCP memory tools.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import {
    addMemoryHandler,
    getMemoryHandler,
    updateMemoryHandler,
    removeMemoryHandler,
    moveMemoryHandler,
    listMemoriesHandler,
    pruneMemoriesHandler,
    addMemoryInputSchema,
    getMemoryInputSchema,
    updateMemoryInputSchema,
    removeMemoryInputSchema,
    moveMemoryInputSchema,
    listMemoriesInputSchema,
    pruneMemoriesInputSchema,
    type AddMemoryInput,
    type GetMemoryInput,
    type UpdateMemoryInput,
    type RemoveMemoryInput,
    type MoveMemoryInput,
    type ListMemoriesInput,
    type PruneMemoriesInput,
} from './tools.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import { serializeMemoryFile, type MemoryFileContents } from '../../core/memory/index.ts';
import { serializeIndex } from '../../core/serialization.ts';
import { serializeStoreRegistry } from '../../core/store/registry.ts';
import { MEMORY_SUBDIR } from '../config.ts';

// Test configuration
const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

// Helper to create test directory with store registry
const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });

    // Create stores.yaml registry pointing default store to memory subdirectory
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });
    const registry = { default: { path: memoryDir } };
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok) {
        throw new Error(`Failed to serialize registry: ${serialized.error.message}`);
    }
    await writeFile(join(testDir, 'stores.yaml'), serialized.value);

    return testDir;
};

// Helper to register an additional store in the registry
const registerStore = async (
    testDir: string,
    storeName: string,
    storePath: string
): Promise<void> => {
    const registryPath = join(testDir, 'stores.yaml');
    const memoryDir = join(testDir, MEMORY_SUBDIR);

    // Create the store directory
    await mkdir(storePath, { recursive: true });

    // Build registry with default + new store
    const registry = {
        default: { path: memoryDir },
        [storeName]: { path: storePath },
    };
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok) {
        throw new Error(`Failed to serialize registry: ${serialized.error.message}`);
    }
    await writeFile(registryPath, serialized.value);
};

// Helper to create a memory file directly
const createMemoryFile = async (
    storeRoot: string,
    slugPath: string,
    contents: MemoryFileContents
): Promise<void> => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    const serialized = serializeMemoryFile(contents);
    if (!serialized.ok) {
        throw new Error(`Failed to serialize: ${serialized.error.message}`);
    }
    const result = await adapter.writeMemoryFile(slugPath, serialized.value, {
        allowIndexCreate: true,
        allowIndexUpdate: true,
    });
    if (!result.ok) {
        throw new Error(`Failed to write: ${result.error.message}`);
    }
};

describe('cortex_add_memory tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new memory', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/test-memory',
            content: 'Test content',
        };

        const result = await addMemoryHandler({ config }, input);

        expect(result.content).toHaveLength(1);
        expect(result.content[0]!.text).toContain('Memory created');
        expect(result.content[0]!.text).toContain('project/test-memory');
    });

    it('should create a memory with tags', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/tagged-memory',
            content: 'Content with tags',
            tags: ['test', 'example'],
        };

        const result = await addMemoryHandler({ config }, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(
            { config },
            {
                store: 'default',
                path: 'project/tagged-memory',
            }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.tags).toEqual(['test', 'example']);
    });

    it('should create a memory with expiration', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/expiring-memory',
            content: 'Expiring content',
            expires_at: futureDate,
        };

        const result = await addMemoryHandler({ config }, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(
            { config },
            {
                store: 'default',
                path: 'project/expiring-memory',
            }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeDefined();
    });

    it('should reject unregistered store names', async () => {
        const input: AddMemoryInput = {
            store: 'unregistered-store',
            path: 'project/memory-in-new-store',
            content: 'Content in new store',
        };

        await expect(addMemoryHandler({ config }, input)).rejects.toThrow('not registered');
    });

    it('should reject invalid paths', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'invalid', // Missing category
            content: 'Content',
        };

        await expect(addMemoryHandler({ config }, input)).rejects.toThrow();
    });
});

describe('cortex_get_memory tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        // Create a test memory - use registry path directly (no 'default' subdirectory)
        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/existing-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['existing'],
                source: 'test',
            },
            content: 'Existing content',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should retrieve a memory', async () => {
        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/existing-memory',
        };

        const result = await getMemoryHandler({ config }, input);

        const output = JSON.parse(result.content[0]!.text);
        expect(output.path).toBe('project/existing-memory');
        expect(output.content).toBe('Existing content');
        expect(output.metadata.tags).toEqual(['existing']);
        expect(output.metadata.source).toBe('test');
    });

    it('should return error for non-existent memory', async () => {
        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
        };

        await expect(getMemoryHandler({ config }, input)).rejects.toThrow('not found');
    });

    it('should not return expired memory by default', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'), // Already expired
            },
            content: 'Expired content',
        });

        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/expired-memory',
        };

        await expect(getMemoryHandler({ config }, input)).rejects.toThrow('expired');
    });

    it('should return expired memory when include_expired is true', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-memory-2', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
            },
            content: 'Expired content',
        });

        const input: GetMemoryInput = {
            store: 'default',
            path: 'project/expired-memory-2',
            include_expired: true,
        };

        const result = await getMemoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);
        expect(output.content).toBe('Expired content');
    });
});

describe('cortex_update_memory tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/update-target', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['original'],
                source: 'test',
            },
            content: 'Original content',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should update memory content', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            content: 'Updated content',
        };

        const result = await updateMemoryHandler({ config }, input);
        expect(result.content[0]!.text).toContain('Memory updated');

        // Verify
        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/update-target' }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.content).toBe('Updated content');
    });

    it('should update memory tags', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            tags: ['new-tag'],
        };

        await updateMemoryHandler({ config }, input);

        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/update-target' }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.tags).toEqual(['new-tag']);
    });

    it('should update expiry', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
            expires_at: futureDate,
        };

        await updateMemoryHandler({ config }, input);

        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/update-target' }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeDefined();
    });

    it('should clear expiry', async () => {
        // First add expiry
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/with-expiry', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date(Date.now() + 86400000),
            },
            content: 'Content with expiry',
        });

        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/with-expiry',
            clear_expiry: true,
        };

        await updateMemoryHandler({ config }, input);

        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/with-expiry' }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeUndefined();
    });

    it('should reject update with no changes', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-target',
        };

        await expect(updateMemoryHandler({ config }, input)).rejects.toThrow('No updates');
    });

    it('should return error for non-existent memory', async () => {
        const input: UpdateMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
            content: 'New content',
        };

        await expect(updateMemoryHandler({ config }, input)).rejects.toThrow('not found');
    });
});

describe('cortex_remove_memory tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/remove-target', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Content to remove',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should remove a memory', async () => {
        const input: RemoveMemoryInput = {
            store: 'default',
            path: 'project/remove-target',
        };

        const result = await removeMemoryHandler({ config }, input);
        expect(result.content[0]!.text).toContain('Memory removed');

        // Verify it's gone
        await expect(
            getMemoryHandler({ config }, { store: 'default', path: 'project/remove-target' })
        ).rejects.toThrow('not found');
    });

    it('should return error for non-existent memory', async () => {
        const input: RemoveMemoryInput = {
            store: 'default',
            path: 'project/non-existent',
        };

        await expect(removeMemoryHandler({ config }, input)).rejects.toThrow('not found');
    });
});

describe('cortex_move_memory tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        await createMemoryFile(storeRoot, 'project/move-source', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['movable'],
                source: 'test',
            },
            content: 'Content to move',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should move a memory', async () => {
        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/move-source',
            to_path: 'project/move-destination',
        };

        const result = await moveMemoryHandler({ config }, input);
        expect(result.content[0]!.text).toContain('Memory moved');

        // Verify source is gone
        await expect(
            getMemoryHandler({ config }, { store: 'default', path: 'project/move-source' })
        ).rejects.toThrow('not found');

        // Verify destination exists
        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/move-destination' }
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.content).toBe('Content to move');
    });

    it('should return error for non-existent source', async () => {
        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/non-existent',
            to_path: 'project/destination',
        };

        await expect(moveMemoryHandler({ config }, input)).rejects.toThrow('not found');
    });

    it('should return error when destination exists', async () => {
        // Create destination
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/existing-destination', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Existing at destination',
        });

        const input: MoveMemoryInput = {
            store: 'default',
            from_path: 'project/move-source',
            to_path: 'project/existing-destination',
        };

        await expect(moveMemoryHandler({ config }, input)).rejects.toThrow('already exists');
    });
});

describe('cortex_list_memories tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        // Create multiple memories
        await createMemoryFile(storeRoot, 'project/memory-1', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Memory 1',
        });

        await createMemoryFile(storeRoot, 'project/memory-2', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Memory 2',
        });

        await createMemoryFile(storeRoot, 'human/preference', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Human preference',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should list memories in a category', async () => {
        const input: ListMemoriesInput = {
            store: 'default',
            category: 'project',
        };

        const result = await listMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('project');
        expect(output.count).toBe(2);
        expect(output.memories).toHaveLength(2);
    });

    it('should list all memories when no category specified', async () => {
        const input: ListMemoriesInput = {
            store: 'default',
        };

        const result = await listMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.category).toBe('all');
        expect(output.count).toBe(3);
    });

    it('should exclude expired memories by default', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
            },
            content: 'Expired',
        });

        const input: ListMemoriesInput = {
            store: 'default',
            category: 'project',
        };

        const result = await listMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        // Should not include the expired memory
        expect(output.count).toBe(2);
    });

    it('should include expired memories when flag is set', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/expired-2', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
            },
            content: 'Expired',
        });

        const input: ListMemoriesInput = {
            store: 'default',
            category: 'project',
            include_expired: true,
        };

        const result = await listMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        // Should include the expired memory
        expect(output.count).toBe(3);
    });

    it('should include subcategory descriptions in response', async () => {
        // Create a subcategory with a description using index manipulation
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

        // Write an index with a described subcategory
        const indexContent = serializeIndex({
            memories: [],
            subcategories: [
                { path: 'project/cortex', memoryCount: 0, description: 'Cortex memory system' },
                { path: 'project/other', memoryCount: 0 },
            ],
        });
        expect(indexContent.ok).toBe(true);
        if (indexContent.ok) {
            await adapter.writeIndexFile('project', indexContent.value);
        }

        const input: ListMemoriesInput = {
            store: 'default',
            category: 'project',
        };

        const result = await listMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.subcategories).toBeDefined();
        expect(output.subcategories).toHaveLength(2);

        const cortexSubcat = output.subcategories.find(
            (s: { path: string }) => s.path === 'project/cortex'
        );
        expect(cortexSubcat).toBeDefined();
        expect(cortexSubcat.description).toBe('Cortex memory system');

        const otherSubcat = output.subcategories.find(
            (s: { path: string }) => s.path === 'project/other'
        );
        expect(otherSubcat).toBeDefined();
        expect(otherSubcat.description).toBeUndefined();
    });
});

describe('cortex_prune_memories tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const storeRoot = join(testDir, MEMORY_SUBDIR);

        // Create mix of expired and non-expired memories
        await createMemoryFile(storeRoot, 'project/active', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Active memory',
        });

        await createMemoryFile(storeRoot, 'project/expired-1', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
            },
            content: 'Expired 1',
        });

        await createMemoryFile(storeRoot, 'human/expired-2', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                expiresAt: new Date('2020-01-01'),
            },
            content: 'Expired 2',
        });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should prune expired memories', async () => {
        const input: PruneMemoriesInput = {
            store: 'default',
        };

        const result = await pruneMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(2);
        expect(output.pruned).toHaveLength(2);

        // Verify active memory still exists
        const getResult = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/active' }
        );
        expect(getResult.content[0]!.text).toContain('Active memory');

        // Verify expired memories are gone
        await expect(
            getMemoryHandler({ config }, { store: 'default', path: 'project/expired-1' })
        ).rejects.toThrow('not found');
    });

    it('should return zero when no memories are expired', async () => {
        // Register and create clean-store
        const cleanStorePath = join(testDir, MEMORY_SUBDIR, 'clean');
        await registerStore(testDir, 'clean-store', cleanStorePath);

        await createMemoryFile(cleanStorePath, 'project/active', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Active',
        });

        const input: PruneMemoriesInput = {
            store: 'clean-store',
        };

        const result = await pruneMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.pruned_count).toBe(0);
        expect(output.pruned).toHaveLength(0);
    });

    it('should return what would be pruned in dry_run mode without deleting', async () => {
        const input: PruneMemoriesInput = {
            store: 'default',
            dry_run: true,
        };

        const result = await pruneMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(2);
        expect(output.would_prune).toHaveLength(2);

        // Verify memories still exist (not deleted)
        const getResult1 = await getMemoryHandler(
            { config },
            { store: 'default', path: 'project/expired-1', include_expired: true }
        );
        expect(getResult1.content[0]!.text).toContain('Expired 1');

        const getResult2 = await getMemoryHandler(
            { config },
            { store: 'default', path: 'human/expired-2', include_expired: true }
        );
        expect(getResult2.content[0]!.text).toContain('Expired 2');
    });

    it('should return zero in dry_run mode when no memories are expired', async () => {
        // Register and create clean-store
        const cleanStorePath = join(testDir, MEMORY_SUBDIR, 'clean');
        await registerStore(testDir, 'dry-clean-store', cleanStorePath);

        await createMemoryFile(cleanStorePath, 'project/active', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Active',
        });

        const input: PruneMemoriesInput = {
            store: 'dry-clean-store',
            dry_run: true,
        };

        const result = await pruneMemoriesHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.dry_run).toBe(true);
        expect(output.would_prune_count).toBe(0);
        expect(output.would_prune).toHaveLength(0);
    });
});

describe('explicit store parameter', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        // Register the custom store
        const customStorePath = join(testDir, MEMORY_SUBDIR, 'custom');
        await registerStore(testDir, 'my-default-store', customStorePath);

        config.defaultStore = 'my-default-store';
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should use explicit store from input', async () => {
        // Create memory with explicit store
        const addInput: AddMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
            content: 'Test',
        };

        await addMemoryHandler({ config }, addInput);

        // Verify by reading with explicit store name
        const getInput: GetMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
        };

        const result = await getMemoryHandler({ config }, getInput);
        expect(result.content[0]!.text).toContain('Test');
    });
});

describe('memory tool schemas reject missing store parameter', () => {
    it('should reject add_memory without store parameter', () => {
        const input = { path: 'project/test', content: 'test' };
        const result = addMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject get_memory without store parameter', () => {
        const input = { path: 'project/test' };
        const result = getMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject update_memory without store parameter', () => {
        const input = { path: 'project/test', content: 'updated' };
        const result = updateMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject remove_memory without store parameter', () => {
        const input = { path: 'project/test' };
        const result = removeMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject move_memory without store parameter', () => {
        const input = { from_path: 'project/source', to_path: 'project/dest' };
        const result = moveMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject list_memories without store parameter', () => {
        const input = { category: 'project' };
        const result = listMemoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject prune_memories without store parameter', () => {
        const input = {};
        const result = pruneMemoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should accept valid input with store parameter', () => {
        const addInput = { store: 'default', path: 'project/test', content: 'test' };
        expect(addMemoryInputSchema.safeParse(addInput).success).toBe(true);

        const getInput = { store: 'default', path: 'project/test' };
        expect(getMemoryInputSchema.safeParse(getInput).success).toBe(true);

        const updateInput = { store: 'default', path: 'project/test', content: 'updated' };
        expect(updateMemoryInputSchema.safeParse(updateInput).success).toBe(true);

        const removeInput = { store: 'default', path: 'project/test' };
        expect(removeMemoryInputSchema.safeParse(removeInput).success).toBe(true);

        const moveInput = {
            store: 'default',
            from_path: 'project/source',
            to_path: 'project/dest',
        };
        expect(moveMemoryInputSchema.safeParse(moveInput).success).toBe(true);

        const listInput = { store: 'default', category: 'project' };
        expect(listMemoriesInputSchema.safeParse(listInput).success).toBe(true);

        const pruneInput = { store: 'default' };
        expect(pruneMemoriesInputSchema.safeParse(pruneInput).success).toBe(true);
    });
});
