/**
 * End-to-end validation tests for category descriptions feature.
 *
 * These tests verify critical behaviors:
 * 1. Root category protection
 * 2. Category persistence after memory deletion
 * 3. 500 character description limit enforcement
 * 4. Idempotent createCategory behavior
 * 5. Recursive deleteCategory behavior
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import { MEMORY_SUBDIR } from '../config.ts';
import { serializeStoreRegistry } from '@yeseh/cortex-core/store';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
} from './tools.ts';
import { addMemoryHandler, removeMemoryHandler } from '../memory/tools.ts';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

const STORE = 'default';

const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

const createTestDir = async (): Promise<string> => {
    const testDir = await mkdtemp(join(tmpdir(), 'cortex-cat-validation-'));

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

describe('Category Descriptions Validation', () => {
    describe('Root category protection', () => {
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            testDir = await createTestDir();
            config = createTestConfig(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('setDescription should reject root category "project"', async () => {
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'project', description: 'Test description' },
                ),
            ).rejects.toThrow(/root category/i);
        });

        it('setDescription should reject root category "human"', async () => {
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'human', description: 'Test description' },
                ),
            ).rejects.toThrow(/root category/i);
        });

        it('setDescription should reject root category "persona"', async () => {
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'persona', description: 'Test description' },
                ),
            ).rejects.toThrow(/root category/i);
        });

        it('setDescription should reject root category "domain"', async () => {
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'domain', description: 'Test description' },
                ),
            ).rejects.toThrow(/root category/i);
        });

        it('deleteCategory should reject root category "project"', async () => {
            await expect(
                deleteCategoryHandler({ config }, { store: STORE, path: 'project' }),
            ).rejects.toThrow(/root category/i);
        });

        it('deleteCategory should reject root category "human"', async () => {
            await expect(
                deleteCategoryHandler({ config }, { store: STORE, path: 'human' }),
            ).rejects.toThrow(/root category/i);
        });

        it('deleteCategory should reject root category "persona"', async () => {
            await expect(
                deleteCategoryHandler({ config }, { store: STORE, path: 'persona' }),
            ).rejects.toThrow(/root category/i);
        });

        it('deleteCategory should reject root category "domain"', async () => {
            await expect(
                deleteCategoryHandler({ config }, { store: STORE, path: 'domain' }),
            ).rejects.toThrow(/root category/i);
        });

        it('setDescription should allow subcategories of root', async () => {
            // Create a subcategory
            await createCategoryHandler({ config }, { store: STORE, path: 'project/cortex' });

            // Setting description on subcategory should succeed
            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/cortex', description: 'Valid description' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Valid description');
        });

        it('deleteCategory should allow subcategories of root', async () => {
            // Create a subcategory
            await createCategoryHandler({ config }, { store: STORE, path: 'project/cortex' });

            // Deleting subcategory should succeed
            const result = await deleteCategoryHandler(
                { config },
                { store: STORE, path: 'project/cortex' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.deleted).toBe(true);
        });
    });

    describe('Category persistence after memory deletion', () => {
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            testDir = await createTestDir();
            config = createTestConfig(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('category should persist after all memories are deleted', async () => {
            // Create category with description
            await createCategoryHandler({ config }, { store: STORE, path: 'project/cortex' });
            await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/cortex', description: 'Cortex memory system' },
            );

            // Add a memory to the category
            await addMemoryHandler(
                { config },
                {
                    store: STORE,
                    path: 'project/cortex/test-memory',
                    content: 'Test memory content',
                },
            );

            // Remove the memory
            await removeMemoryHandler(
                { config },
                { store: STORE, path: 'project/cortex/test-memory' },
            );

            // Category should still exist - verify by setting description again
            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/cortex', description: 'Updated description' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Updated description');
        });

        it('category with description persists after multiple memories deleted', async () => {
            // Create category with description
            await createCategoryHandler({ config }, { store: STORE, path: 'project/test-cat' });
            await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/test-cat', description: 'Test category' },
            );

            // Add multiple memories
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/test-cat/mem1', content: 'Memory 1' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/test-cat/mem2', content: 'Memory 2' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/test-cat/mem3', content: 'Memory 3' },
            );

            // Remove all memories
            await removeMemoryHandler({ config }, { store: STORE, path: 'project/test-cat/mem1' });
            await removeMemoryHandler({ config }, { store: STORE, path: 'project/test-cat/mem2' });
            await removeMemoryHandler({ config }, { store: STORE, path: 'project/test-cat/mem3' });

            // Category should still exist - can update description
            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/test-cat', description: 'Still here!' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Still here!');
        });

        it('category directory physically exists after memories deleted', async () => {
            // Create category
            await createCategoryHandler({ config }, { store: STORE, path: 'project/persist' });

            // Add and remove memory
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/persist/temp', content: 'Temporary' },
            );
            await removeMemoryHandler({ config }, { store: STORE, path: 'project/persist/temp' });

            // Verify directory still exists using the adapter
            const storeRoot = join(testDir, 'memory');
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
            const existsResult = await adapter.categoryExists('project/persist');

            expect(existsResult.ok).toBe(true);
            if (existsResult.ok) {
                expect(existsResult.value).toBe(true);
            }
        });
    });

    describe('500 character limit enforcement', () => {
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            testDir = await createTestDir();
            config = createTestConfig(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('should accept description at exactly 500 characters', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/exact' });

            const exactDescription = 'a'.repeat(500);
            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/exact', description: exactDescription },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description.length).toBe(500);
        });

        it('should reject description at 501 characters', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/toolong' });

            const longDescription = 'a'.repeat(501);
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'project/toolong', description: longDescription },
                ),
            ).rejects.toThrow(/500 characters/i);
        });

        it('should reject description at 1000 characters', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/waylong' });

            const veryLongDescription = 'a'.repeat(1000);
            await expect(
                setCategoryDescriptionHandler(
                    { config },
                    { store: STORE, path: 'project/waylong', description: veryLongDescription },
                ),
            ).rejects.toThrow(/500 characters/i);
        });

        it('should accept empty description (clears)', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/clear' });
            await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/clear', description: 'Initial' },
            );

            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/clear', description: '' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBeNull();
        });

        it('should trim whitespace from description', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/trimmed' });

            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/trimmed', description: '   Padded description   ' },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Padded description');
        });

        it('should count trimmed length for limit', async () => {
            await createCategoryHandler({ config }, { store: STORE, path: 'project/padcount' });

            // 495 chars + lots of whitespace should be accepted
            const paddedDescription = '   ' + 'a'.repeat(495) + '   ';
            const result = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/padcount', description: paddedDescription },
            );
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description.length).toBe(495);
        });
    });

    describe('Idempotent createCategory behavior', () => {
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            testDir = await createTestDir();
            config = createTestConfig(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('calling createCategory twice should succeed without error', async () => {
            // First call
            const result1 = await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/idempotent' },
            );
            const output1 = JSON.parse(result1.content[0]!.text);
            expect(output1.created).toBe(true);

            // Second call - should not throw
            const result2 = await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/idempotent' },
            );
            const output2 = JSON.parse(result2.content[0]!.text);
            expect(output2.created).toBe(false);
        });

        it('calling createCategory multiple times should be safe', async () => {
            const path = 'project/multi-create';

            // Call 5 times
            for (let i = 0; i < 5; i++) {
                const result = await createCategoryHandler({ config }, { store: STORE, path });
                const output = JSON.parse(result.content[0]!.text);

                if (i === 0) {
                    expect(output.created).toBe(true);
                }
                else {
                    expect(output.created).toBe(false);
                }
            }
        });

        it('createCategory idempotency preserves existing description', async () => {
            // Create category and set description
            await createCategoryHandler({ config }, { store: STORE, path: 'project/preserve' });
            await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/preserve', description: 'Preserved description' },
            );

            // Call createCategory again
            const createResult = await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/preserve' },
            );
            const createOutput = JSON.parse(createResult.content[0]!.text);
            expect(createOutput.created).toBe(false);

            // Verify description is still there by updating it
            // (we can't directly read, but we can set and verify the response)
            const descResult = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/preserve', description: 'New description' },
            );
            const descOutput = JSON.parse(descResult.content[0]!.text);
            expect(descOutput.description).toBe('New description');
        });

        it('createCategory with different paths creates different categories', async () => {
            const result1 = await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/cat1' },
            );
            const result2 = await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/cat2' },
            );

            const output1 = JSON.parse(result1.content[0]!.text);
            const output2 = JSON.parse(result2.content[0]!.text);

            expect(output1.created).toBe(true);
            expect(output2.created).toBe(true);
        });
    });

    describe('Recursive deleteCategory behavior', () => {
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            testDir = await createTestDir();
            config = createTestConfig(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('should delete category with nested subcategories', async () => {
            // Create nested structure
            await createCategoryHandler({ config }, { store: STORE, path: 'project/parent' });
            await createCategoryHandler({ config }, { store: STORE, path: 'project/parent/child' });
            await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/parent/child/grandchild' },
            );

            const storeRoot = join(testDir, 'memory');
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

            // Verify all exist before delete
            const beforeParent = await adapter.categoryExists('project/parent');
            const beforeChild = await adapter.categoryExists('project/parent/child');
            const beforeGrandchild = await adapter.categoryExists(
                'project/parent/child/grandchild',
            );
            expect(beforeParent.ok && beforeParent.value).toBe(true);
            expect(beforeChild.ok && beforeChild.value).toBe(true);
            expect(beforeGrandchild.ok && beforeGrandchild.value).toBe(true);

            // Delete parent - should delete all nested
            const result = await deleteCategoryHandler(
                { config },
                { store: STORE, path: 'project/parent' },
            );
            const output = JSON.parse(result.content[0]!.text);
            expect(output.deleted).toBe(true);

            // Verify all are deleted from filesystem
            const afterParent = await adapter.categoryExists('project/parent');
            const afterChild = await adapter.categoryExists('project/parent/child');
            const afterGrandchild = await adapter.categoryExists('project/parent/child/grandchild');
            expect(afterParent.ok && afterParent.value).toBe(false);
            expect(afterChild.ok && afterChild.value).toBe(false);
            expect(afterGrandchild.ok && afterGrandchild.value).toBe(false);
        });

        it('should delete category with memories', async () => {
            // Create category with memory
            await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/with-memories' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/with-memories/mem1', content: 'Memory 1' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/with-memories/mem2', content: 'Memory 2' },
            );

            const storeRoot = join(testDir, 'memory');
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

            // Verify category exists before delete
            const beforeResult = await adapter.categoryExists('project/with-memories');
            expect(beforeResult.ok && beforeResult.value).toBe(true);

            // Delete category
            const result = await deleteCategoryHandler(
                { config },
                { store: STORE, path: 'project/with-memories' },
            );
            const output = JSON.parse(result.content[0]!.text);
            expect(output.deleted).toBe(true);

            // Verify category is gone from filesystem
            const afterResult = await adapter.categoryExists('project/with-memories');
            expect(afterResult.ok && afterResult.value).toBe(false);

            // Verify memories are also gone
            const mem1 = await adapter.readMemoryFile('project/with-memories/mem1');
            const mem2 = await adapter.readMemoryFile('project/with-memories/mem2');
            expect(mem1.ok && mem1.value === null).toBe(true);
            expect(mem2.ok && mem2.value === null).toBe(true);
        });

        it('should delete category with nested subcategories and memories', async () => {
            // Create complex structure
            await createCategoryHandler({ config }, { store: STORE, path: 'project/complex' });
            await createCategoryHandler({ config }, { store: STORE, path: 'project/complex/sub1' });
            await createCategoryHandler({ config }, { store: STORE, path: 'project/complex/sub2' });

            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/complex/mem1', content: 'Parent memory' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/complex/sub1/mem2', content: 'Child memory' },
            );
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/complex/sub2/mem3', content: 'Another child memory' },
            );

            const storeRoot = join(testDir, 'memory');
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

            // Verify everything exists before delete
            const beforeComplex = await adapter.categoryExists('project/complex');
            const beforeSub1 = await adapter.categoryExists('project/complex/sub1');
            const beforeSub2 = await adapter.categoryExists('project/complex/sub2');
            expect(beforeComplex.ok && beforeComplex.value).toBe(true);
            expect(beforeSub1.ok && beforeSub1.value).toBe(true);
            expect(beforeSub2.ok && beforeSub2.value).toBe(true);

            // Delete parent
            const result = await deleteCategoryHandler(
                { config },
                { store: STORE, path: 'project/complex' },
            );
            const output = JSON.parse(result.content[0]!.text);
            expect(output.deleted).toBe(true);

            // All should be gone from filesystem
            const afterComplex = await adapter.categoryExists('project/complex');
            const afterSub1 = await adapter.categoryExists('project/complex/sub1');
            const afterSub2 = await adapter.categoryExists('project/complex/sub2');
            expect(afterComplex.ok && afterComplex.value).toBe(false);
            expect(afterSub1.ok && afterSub1.value).toBe(false);
            expect(afterSub2.ok && afterSub2.value).toBe(false);

            // Memories should also be gone
            const mem1 = await adapter.readMemoryFile('project/complex/mem1');
            const mem2 = await adapter.readMemoryFile('project/complex/sub1/mem2');
            const mem3 = await adapter.readMemoryFile('project/complex/sub2/mem3');
            expect(mem1.ok && mem1.value === null).toBe(true);
            expect(mem2.ok && mem2.value === null).toBe(true);
            expect(mem3.ok && mem3.value === null).toBe(true);
        });

        it('should delete deeply nested category without affecting siblings', async () => {
            // Create sibling categories
            await createCategoryHandler({ config }, { store: STORE, path: 'project/keep' });
            await createCategoryHandler({ config }, { store: STORE, path: 'project/delete-me' });
            await createCategoryHandler(
                { config },
                { store: STORE, path: 'project/delete-me/nested' },
            );

            await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/keep', description: 'I should stay' },
            );

            // Delete one branch
            const result = await deleteCategoryHandler(
                { config },
                { store: STORE, path: 'project/delete-me' },
            );
            const output = JSON.parse(result.content[0]!.text);
            expect(output.deleted).toBe(true);

            // Sibling should still exist
            const siblingResult = await setCategoryDescriptionHandler(
                { config },
                { store: STORE, path: 'project/keep', description: 'Still here!' },
            );
            const siblingOutput = JSON.parse(siblingResult.content[0]!.text);
            expect(siblingOutput.description).toBe('Still here!');
        });

        it('should verify directory is actually deleted from filesystem', async () => {
            // Create category
            await createCategoryHandler({ config }, { store: STORE, path: 'project/todelete' });
            await addMemoryHandler(
                { config },
                { store: STORE, path: 'project/todelete/mem', content: 'test' },
            );

            const storeRoot = join(testDir, 'memory');
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

            // Verify it exists
            const beforeResult = await adapter.categoryExists('project/todelete');
            expect(beforeResult.ok).toBe(true);
            if (beforeResult.ok) {
                expect(beforeResult.value).toBe(true);
            }

            // Delete it
            await deleteCategoryHandler({ config }, { store: STORE, path: 'project/todelete' });

            // Verify it's gone
            const afterResult = await adapter.categoryExists('project/todelete');
            expect(afterResult.ok).toBe(true);
            if (afterResult.ok) {
                expect(afterResult.value).toBe(false);
            }
        });
    });
});
