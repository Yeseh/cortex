/**
 * Unit tests for MCP memory resources.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import {
    readMemoryContent,
    readCategoryListing,
    listResources,
    buildResourceUri,
    parseUriVariables,
    resolveStoreRoot,
    createAdapter,
    ROOT_CATEGORIES,
    MEMORY_URI_SCHEME,
    type CategoryListing,
} from './resources.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import { serializeMemoryFile, type MemoryFileContents } from '../../core/memory/file.ts';
import { serializeCategoryIndex } from '../../core/index/parser.ts';
import type { CategoryIndex } from '../../core/index/types.ts';

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

// Helper to create test directory
const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    return testDir;
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

// Helper to create a category index directly
const createCategoryIndex = async (
    storeRoot: string,
    categoryPath: string,
    index: CategoryIndex
): Promise<void> => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    const serialized = serializeCategoryIndex(index);
    if (!serialized.ok) {
        throw new Error(`Failed to serialize index: ${serialized.error.message}`);
    }
    const result = await adapter.writeIndexFile(categoryPath, serialized.value);
    if (!result.ok) {
        throw new Error(`Failed to write index: ${result.error.message}`);
    }
};

// Helper to safely extract text content from resource result
const getTextContent = (
    content: { uri: string; text?: string; blob?: string } | undefined
): string => {
    if (!content) {
        throw new Error('Content is undefined');
    }
    if ('text' in content && content.text !== undefined) {
        return content.text;
    }
    throw new Error('Content does not have text property');
};

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('buildResourceUri', () => {
    it('should build URI for memory content (no trailing slash)', () => {
        const uri = buildResourceUri('default', 'project/my-memory', false);
        expect(uri).toBe('cortex://memory/default/project/my-memory');
    });

    it('should build URI for category listing (with trailing slash)', () => {
        const uri = buildResourceUri('default', 'project', true);
        expect(uri).toBe('cortex://memory/default/project/');
    });

    it('should handle root category listing', () => {
        const uri = buildResourceUri('default', '', true);
        expect(uri).toBe('cortex://memory/default/');
    });

    it('should handle nested category paths', () => {
        const uri = buildResourceUri('default', 'project/subcategory', true);
        expect(uri).toBe('cortex://memory/default/project/subcategory/');
    });
});

describe('parseUriVariables', () => {
    let config: ServerConfig;

    beforeEach(() => {
        config = createTestConfig('/tmp/cortex-test');
    });

    it('should parse store and path from variables', () => {
        const variables = { store: 'my-store', 'path*': 'project/my-memory' };
        const result = parseUriVariables(variables, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.store).toBe('my-store');
            expect(result.value.path).toBe('project/my-memory');
            expect(result.value.isCategory).toBe(false);
        }
    });

    it('should use default store when store is not provided', () => {
        const variables = { 'path*': 'project/my-memory' };
        const result = parseUriVariables(variables, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.store).toBe('default');
        }
    });

    it('should detect category listing when path ends with slash', () => {
        const variables = { store: 'default', 'path*': 'project/' };
        const result = parseUriVariables(variables, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isCategory).toBe(true);
            expect(result.value.path).toBe('project');
        }
    });

    it('should detect category listing when path is empty', () => {
        const variables = { store: 'default', 'path*': '' };
        const result = parseUriVariables(variables, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isCategory).toBe(true);
            expect(result.value.path).toBe('');
        }
    });

    it('should handle path* as array', () => {
        const variables = { store: 'default', 'path*': ['project', 'subcategory', 'memory'] };
        const result = parseUriVariables(variables, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.path).toBe('project/subcategory/memory');
        }
    });
});

describe('resolveStoreRoot', () => {
    it('should resolve store root with provided store name', () => {
        const config = createTestConfig('/data/cortex');
        const result = resolveStoreRoot(config, 'my-store');
        expect(result).toContain('my-store');
    });

    it('should use default store when store name is undefined', () => {
        const config = createTestConfig('/data/cortex');
        const result = resolveStoreRoot(config, undefined);
        expect(result).toContain('default');
    });
});

// ---------------------------------------------------------------------------
// Memory Content Resource Tests
// ---------------------------------------------------------------------------

describe('readMemoryContent', () => {
    let testDir: string;
    let storeRoot: string;
    let adapter: FilesystemStorageAdapter;

    beforeEach(async () => {
        testDir = await createTestDir();
        storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });
        adapter = createAdapter(storeRoot);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should retrieve memory content at a valid path', async () => {
        await createMemoryFile(storeRoot, 'project/test-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['test'],
                source: 'test',
            },
            content: 'This is the memory content',
        });

        const result = await readMemoryContent(adapter, 'default', 'project/test-memory');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.contents).toHaveLength(1);
            const text = getTextContent(result.value.contents[0]);
            expect(text).toBe('This is the memory content');
        }
    });

    it('should return correct MIME type (text/plain)', async () => {
        await createMemoryFile(storeRoot, 'project/mime-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Content for MIME test',
        });

        const result = await readMemoryContent(adapter, 'default', 'project/mime-test');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            expect(content!.mimeType).toBe('text/plain');
        }
    });

    it('should return correct URI in response', async () => {
        await createMemoryFile(storeRoot, 'project/uri-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Content for URI test',
        });

        const result = await readMemoryContent(adapter, 'my-store', 'project/uri-test');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            expect(content!.uri).toBe('cortex://memory/my-store/project/uri-test');
        }
    });

    it('should handle nested category paths', async () => {
        await createMemoryFile(storeRoot, 'project/subcategory/deep-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['nested'],
                source: 'test',
            },
            content: 'Deeply nested memory content',
        });

        const result = await readMemoryContent(
            adapter,
            'default',
            'project/subcategory/deep-memory'
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            expect(text).toBe('Deeply nested memory content');
            expect(content!.uri).toContain('project/subcategory/deep-memory');
        }
    });

    it('should return error for non-existent memory', async () => {
        const result = await readMemoryContent(adapter, 'default', 'project/non-existent');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('not found');
        }
    });

    it('should return error for invalid memory path format', async () => {
        const result = await readMemoryContent(adapter, 'default', 'invalid');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Invalid memory path');
        }
    });
});

// ---------------------------------------------------------------------------
// Category Listing Resource Tests
// ---------------------------------------------------------------------------

describe('readCategoryListing', () => {
    let testDir: string;
    let storeRoot: string;
    let adapter: FilesystemStorageAdapter;

    beforeEach(async () => {
        testDir = await createTestDir();
        storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });
        adapter = createAdapter(storeRoot);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should list memories in a category', async () => {
        // Create memories which automatically create the index
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

        const result = await readCategoryListing(adapter, 'default', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);

            expect(listing.category).toBe('project');
            expect(listing.memories).toHaveLength(2);
            expect(listing.memories.map((m) => m.path)).toContain('project/memory-1');
            expect(listing.memories.map((m) => m.path)).toContain('project/memory-2');
        }
    });

    it('should list subcategories', async () => {
        // Create a memory in a subcategory
        await createMemoryFile(storeRoot, 'project/subcategory/sub-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Subcategory memory',
        });

        const result = await readCategoryListing(adapter, 'default', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);

            expect(listing.subcategories).toHaveLength(1);
            expect(listing.subcategories[0]!.path).toBe('project/subcategory');
            expect(listing.subcategories[0]!.memoryCount).toBe(1);
        }
    });

    it('should return correct JSON structure', async () => {
        await createMemoryFile(storeRoot, 'project/structure-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['tag1'],
                source: 'test',
            },
            content: 'Test content',
        });

        const result = await readCategoryListing(adapter, 'default', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);

            // Verify structure has all required fields
            expect(listing).toHaveProperty('category');
            expect(listing).toHaveProperty('memories');
            expect(listing).toHaveProperty('subcategories');

            // Verify memory entry structure
            const firstMemory = listing.memories[0];
            expect(firstMemory).toBeDefined();
            expect(firstMemory).toHaveProperty('path');
            expect(firstMemory).toHaveProperty('uri');
            expect(firstMemory).toHaveProperty('tokenEstimate');
        }
    });

    it('should return correct MIME type (application/json)', async () => {
        await createMemoryFile(storeRoot, 'project/mime-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'MIME test',
        });

        const result = await readCategoryListing(adapter, 'default', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            expect(content!.mimeType).toBe('application/json');
        }
    });

    it('should handle root category listing (empty path)', async () => {
        // Create memories in different root categories
        await createMemoryFile(storeRoot, 'project/root-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Project memory',
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

        const result = await readCategoryListing(adapter, 'default', '');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);

            expect(listing.category).toBe('');
            expect(listing.memories).toHaveLength(0); // Root has no direct memories
            expect(listing.subcategories.length).toBeGreaterThan(0);

            const subcategoryPaths = listing.subcategories.map((s) => s.path);
            expect(subcategoryPaths).toContain('project');
            expect(subcategoryPaths).toContain('human');
        }
    });

    it('should return error for non-existent category', async () => {
        const result = await readCategoryListing(adapter, 'default', 'non-existent-category');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('not found');
        }
    });

    it('should include URI for each memory in listing', async () => {
        await createMemoryFile(storeRoot, 'project/uri-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'URI test memory',
        });

        const result = await readCategoryListing(adapter, 'my-store', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);
            expect(listing.memories[0]!.uri).toBe('cortex://memory/my-store/project/uri-memory');
        }
    });

    it('should include URI for each subcategory in listing', async () => {
        await createMemoryFile(storeRoot, 'project/sub/memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Subcategory memory',
        });

        const result = await readCategoryListing(adapter, 'my-store', 'project');

        expect(result.ok).toBe(true);
        if (result.ok) {
            const content = result.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);
            expect(listing.subcategories[0]!.uri).toBe('cortex://memory/my-store/project/sub/');
        }
    });
});

// ---------------------------------------------------------------------------
// Resource Discovery Tests
// ---------------------------------------------------------------------------

describe('listResources', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should list available resources', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/my-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['test'],
                source: 'test',
            },
            content: 'Test memory content',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.resources.length).toBeGreaterThan(0);
        }
    });

    it('should include root store resource', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/root-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Root test',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const rootResource = result.value.resources.find((r) =>
                r.name.includes('Memory Store')
            );
            expect(rootResource).toBeDefined();
            expect(rootResource!.uri).toBe('cortex://memory/default/');
            expect(rootResource!.mimeType).toBe('application/json');
        }
    });

    it('should include category resources', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/category-test', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Category test',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const categoryResource = result.value.resources.find(
                (r) => r.name === 'Category: project'
            );
            expect(categoryResource).toBeDefined();
            expect(categoryResource!.uri).toBe('cortex://memory/default/project/');
            expect(categoryResource!.mimeType).toBe('application/json');
        }
    });

    it('should include memory resources', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/memory-resource', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Memory resource test',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const memoryResource = result.value.resources.find(
                (r) => r.name === 'Memory: project/memory-resource'
            );
            expect(memoryResource).toBeDefined();
            expect(memoryResource!.uri).toBe('cortex://memory/default/project/memory-resource');
            expect(memoryResource!.mimeType).toBe('text/plain');
        }
    });

    it('should include subcategory resources', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/sub/nested-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Nested memory',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const subResource = result.value.resources.find(
                (r) => r.name === 'Category: project/sub'
            );
            expect(subResource).toBeDefined();
            expect(subResource!.uri).toBe('cortex://memory/default/project/sub/');
        }
    });

    it('should return empty resources when no memories exist', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Should still have root resource
            expect(result.value.resources.length).toBe(1);
            expect(result.value.resources[0]!.name).toContain('Memory Store');
        }
    });

    it('should list resources from multiple root categories', async () => {
        const storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });

        await createMemoryFile(storeRoot, 'project/project-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Project memory',
        });

        await createMemoryFile(storeRoot, 'human/human-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Human memory',
        });

        await createMemoryFile(storeRoot, 'persona/persona-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
            },
            content: 'Persona memory',
        });

        const result = await listResources(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            const categoryNames = result.value.resources
                .filter((r) => r.name.startsWith('Category:'))
                .map((r) => r.name);

            expect(categoryNames).toContain('Category: project');
            expect(categoryNames).toContain('Category: human');
            expect(categoryNames).toContain('Category: persona');
        }
    });
});

// ---------------------------------------------------------------------------
// Constants and Configuration Tests
// ---------------------------------------------------------------------------

describe('constants', () => {
    it('should export ROOT_CATEGORIES', () => {
        expect(ROOT_CATEGORIES).toBeDefined();
        expect(ROOT_CATEGORIES).toContain('human');
        expect(ROOT_CATEGORIES).toContain('persona');
        expect(ROOT_CATEGORIES).toContain('project');
        expect(ROOT_CATEGORIES).toContain('domain');
    });

    it('should export MEMORY_URI_SCHEME', () => {
        expect(MEMORY_URI_SCHEME).toBe('cortex://memory');
    });
});

// ---------------------------------------------------------------------------
// Edge Cases and Error Handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
    let testDir: string;
    let storeRoot: string;
    let adapter: FilesystemStorageAdapter;

    beforeEach(async () => {
        testDir = await createTestDir();
        storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });
        adapter = createAdapter(storeRoot);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should handle memory path with special characters in slug', async () => {
        // The path validation should reject invalid characters
        const result = await readMemoryContent(adapter, 'default', 'project/invalid..path');

        expect(result.ok).toBe(false);
    });

    it('should handle path traversal attempts', async () => {
        const result = await readMemoryContent(adapter, 'default', 'project/../../../etc/passwd');

        expect(result.ok).toBe(false);
    });

    it('should handle empty store name', async () => {
        const config = createTestConfig(testDir);
        const result = parseUriVariables({ store: '', 'path*': 'project/memory' }, config);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty store should fall back to default
            expect(result.value.store).toBe('default');
        }
    });
});

// ---------------------------------------------------------------------------
// Integration-style tests
// ---------------------------------------------------------------------------

describe('resource workflow', () => {
    let testDir: string;
    let config: ServerConfig;
    let storeRoot: string;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
        storeRoot = join(testDir, 'default');
        await mkdir(storeRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should support full browse workflow: list -> category -> memory', async () => {
        // Create test data
        await createMemoryFile(storeRoot, 'project/workflow-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['workflow'],
                source: 'test',
            },
            content: 'Workflow test content',
        });

        // Step 1: List all resources
        const listResult = await listResources(config);
        expect(listResult.ok).toBe(true);

        // Step 2: Browse category listing
        const adapter = createAdapter(storeRoot);
        const categoryResult = await readCategoryListing(adapter, 'default', 'project');
        expect(categoryResult.ok).toBe(true);
        if (categoryResult.ok) {
            const content = categoryResult.value.contents[0];
            expect(content).toBeDefined();
            const text = getTextContent(content);
            const listing: CategoryListing = JSON.parse(text);
            expect(listing.memories.length).toBe(1);
            expect(listing.memories[0]!.path).toBe('project/workflow-memory');
        }

        // Step 3: Read specific memory
        const memoryResult = await readMemoryContent(adapter, 'default', 'project/workflow-memory');
        expect(memoryResult.ok).toBe(true);
        if (memoryResult.ok) {
            const text = getTextContent(memoryResult.value.contents[0]);
            expect(text).toBe('Workflow test content');
        }
    });

    it('should handle deeply nested category structure', async () => {
        await createMemoryFile(storeRoot, 'project/level1/level2/deep-memory', {
            frontmatter: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: ['deep'],
                source: 'test',
            },
            content: 'Deep nested content',
        });

        const adapter = createAdapter(storeRoot);

        // Check each level
        const level1Result = await readCategoryListing(adapter, 'default', 'project');
        expect(level1Result.ok).toBe(true);

        const level2Result = await readCategoryListing(adapter, 'default', 'project/level1');
        expect(level2Result.ok).toBe(true);

        const memoryResult = await readMemoryContent(
            adapter,
            'default',
            'project/level1/level2/deep-memory'
        );
        expect(memoryResult.ok).toBe(true);
        if (memoryResult.ok) {
            const text = getTextContent(memoryResult.value.contents[0]);
            expect(text).toBe('Deep nested content');
        }
    });
});
