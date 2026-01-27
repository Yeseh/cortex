import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemStorageAdapter } from './index.ts';
import { parseIndex, serializeIndex } from '../../serialization.ts';

describe('filesystem storage adapter', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-storage-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should write and read memory files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const writeResult = await adapter.writeMemoryFile(
            'working/storage-test',
            'Filesystem payload'
        );

        expect(writeResult.ok).toBe(true);

        const readResult = await adapter.readMemoryFile('working/storage-test');

        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
            expect(readResult.value).toBe('Filesystem payload');
        }
    });

    it('should store memories directly under store root', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        await adapter.writeMemoryFile('global/test-memory', 'test content', {
            allowIndexUpdate: false,
        });

        // Verify physical file location
        const memoryPath = join(tempDir, 'global', 'test-memory.md');
        const content = await fs.readFile(memoryPath, 'utf8');
        expect(content).toBe('test content');
    });

    it('should return ok(null) for missing memory files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.readMemoryFile('working/missing-file');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeNull();
        }
    });

    it('should reject memory path traversal', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const readResult = await adapter.readMemoryFile('../escape');

        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
            expect(readResult.error.code).toBe('READ_FAILED');
            expect(readResult.error.message).toContain('Path escapes storage root');
        }

        const writeResult = await adapter.writeMemoryFile('../escape', 'nope');

        expect(writeResult.ok).toBe(false);
        if (!writeResult.ok) {
            expect(writeResult.error.code).toBe('WRITE_FAILED');
            expect(writeResult.error.message).toContain('Invalid memory slug path');
        }
    });

    it('should reject index as memory slug', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.writeMemoryFile('global/index', 'content');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('reserved');
        }
    });

    it('should write and read index files at category path', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Write root index (empty string = STORE_ROOT/index.yaml)
        const writeRootResult = await adapter.writeIndexFile('', 'memories: []');
        expect(writeRootResult.ok).toBe(true);

        const readRootResult = await adapter.readIndexFile('');
        expect(readRootResult.ok).toBe(true);
        if (readRootResult.ok) {
            expect(readRootResult.value).toBe('memories: []');
        }

        // Write category index (global = STORE_ROOT/global/index.yaml)
        const writeCatResult = await adapter.writeIndexFile('global', 'memories: []');
        expect(writeCatResult.ok).toBe(true);

        const readCatResult = await adapter.readIndexFile('global');
        expect(readCatResult.ok).toBe(true);
        if (readCatResult.ok) {
            expect(readCatResult.value).toBe('memories: []');
        }
    });

    it('should store indexes in-folder at correct paths', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        await adapter.writeIndexFile('', 'root index');
        await adapter.writeIndexFile('global', 'global index');
        await adapter.writeIndexFile('global/sub', 'sub index');

        // Verify physical file locations using fs.readFile
        const rootIndexPath = join(tempDir, 'index.yaml');
        const globalIndexPath = join(tempDir, 'global', 'index.yaml');
        const subIndexPath = join(tempDir, 'global', 'sub', 'index.yaml');

        const rootContent = await fs.readFile(rootIndexPath, 'utf8');
        expect(rootContent).toBe('root index');

        const globalContent = await fs.readFile(globalIndexPath, 'utf8');
        expect(globalContent).toBe('global index');

        const subContent = await fs.readFile(subIndexPath, 'utf8');
        expect(subContent).toBe('sub index');
    });

    it('should return ok(null) for missing index files', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.readIndexFile('missing-index');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeNull();
        }
    });

    it('should reject index path traversal', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const readResult = await adapter.readIndexFile('../escape-index');

        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
            expect(readResult.error.code).toBe('READ_FAILED');
            expect(readResult.error.message).toContain('Path escapes storage root');
        }
    });
});

describe('CategoryStoragePort implementation', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-cat-storage-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    // Helper to write category index using public methods
    const writeIndex = async (
        adapter: FilesystemStorageAdapter,
        path: string,
        index: {
            memories: Array<{ path: string; tokenEstimate: number }>;
            subcategories: Array<{ path: string; memoryCount: number; description?: string }>;
        }
    ) => {
        const serialized = serializeIndex(index);
        if (!serialized.ok) throw new Error('Failed to serialize index');
        return adapter.writeIndexFile(path, serialized.value);
    };

    it('should check category existence - non-existent', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.categoryExists('project/test');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe(false);
        }
    });

    it('should check category existence - exists', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        await adapter.ensureCategoryDirectory('project/test');
        const result = await adapter.categoryExists('project/test');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe(true);
        }
    });

    it('should create category directory', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        const result = await adapter.ensureCategoryDirectory('project/test/nested');

        expect(result.ok).toBe(true);
        const exists = await adapter.categoryExists('project/test/nested');
        expect(exists.ok && exists.value).toBe(true);
    });

    it('should delete category directory recursively', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Create nested structure
        await adapter.ensureCategoryDirectory('project/test/nested');
        await writeIndex(adapter, 'project/test/nested', { memories: [], subcategories: [] });

        // Delete parent
        const result = await adapter.deleteCategoryDirectory('project/test');

        expect(result.ok).toBe(true);
        const exists = await adapter.categoryExists('project/test');
        expect(exists.ok && exists.value).toBe(false);
    });

    it('should update subcategory description', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup parent with subcategory
        await adapter.ensureCategoryDirectory('project');
        await writeIndex(adapter, 'project', {
            memories: [],
            subcategories: [{ path: 'project/test', memoryCount: 0 }],
        });

        // Update description
        const result = await adapter.updateSubcategoryDescription(
            'project',
            'project/test',
            'Test description'
        );

        expect(result.ok).toBe(true);

        // Verify
        const indexResult = await adapter.readIndexFile('project');
        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.subcategories[0]?.description).toBe('Test description');
            }
        }
    });

    it('should clear description with null', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup with description
        await adapter.ensureCategoryDirectory('project');
        await writeIndex(adapter, 'project', {
            memories: [],
            subcategories: [{ path: 'project/test', memoryCount: 0, description: 'Old desc' }],
        });

        // Clear description
        const result = await adapter.updateSubcategoryDescription('project', 'project/test', null);

        expect(result.ok).toBe(true);

        // Verify description is removed
        const indexResult = await adapter.readIndexFile('project');
        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.subcategories[0]?.description).toBeUndefined();
            }
        }
    });

    it('should create subcategory entry if not exists when setting description', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup empty parent
        await adapter.ensureCategoryDirectory('project');
        await writeIndex(adapter, 'project', { memories: [], subcategories: [] });

        // Set description on non-existent subcategory entry
        const result = await adapter.updateSubcategoryDescription(
            'project',
            'project/new',
            'New description'
        );

        expect(result.ok).toBe(true);

        // Verify entry was created
        const indexResult = await adapter.readIndexFile('project');
        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                const entry = parsed.value.subcategories.find((s) => s.path === 'project/new');
                expect(entry).toBeDefined();
                expect(entry?.description).toBe('New description');
                expect(entry?.memoryCount).toBe(0);
            }
        }
    });

    it('should remove subcategory entry from parent', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup parent with subcategory
        await adapter.ensureCategoryDirectory('project');
        await writeIndex(adapter, 'project', {
            memories: [],
            subcategories: [
                { path: 'project/keep', memoryCount: 1 },
                { path: 'project/remove', memoryCount: 2 },
            ],
        });

        // Remove entry
        const result = await adapter.removeSubcategoryEntry('project', 'project/remove');

        expect(result.ok).toBe(true);

        // Verify
        const indexResult = await adapter.readIndexFile('project');
        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.subcategories).toHaveLength(1);
                expect(parsed.value.subcategories[0]?.path).toBe('project/keep');
            }
        }
    });

    it('should preserve subcategory description when memory count changes', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup root index with subcategory that has a description
        await writeIndex(adapter, '', {
            memories: [],
            subcategories: [{ path: 'project', memoryCount: 0, description: 'Project memories' }],
        });

        // Setup project category index
        await adapter.ensureCategoryDirectory('project');
        await writeIndex(adapter, 'project', { memories: [], subcategories: [] });

        // Add a memory, which triggers upsertSubcategoryEntry with updated count
        const writeResult = await adapter.writeMemoryFile('project/test-memory', 'Test content', {
            allowIndexCreate: true,
            allowIndexUpdate: true,
        });
        expect(writeResult.ok).toBe(true);

        // Verify the description is preserved in the root index
        const indexResult = await adapter.readIndexFile('');
        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                const projectEntry = parsed.value.subcategories.find((s) => s.path === 'project');
                expect(projectEntry).toBeDefined();
                expect(projectEntry?.description).toBe('Project memories');
                expect(projectEntry?.memoryCount).toBe(1);
            }
        }
    });
});
