/**
 * Unit tests for MCP category tools.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { MEMORY_SUBDIR } from '../config.ts';
import { serializeStoreRegistry, Cortex } from '@yeseh/cortex-core';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { ToolContext } from '../memory/tools/shared.ts';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
} from './tools.ts';

const createTestDir = async (): Promise<string> => {
    const testDir = await mkdtemp(join(tmpdir(), 'cortex-cat-tools-'));

    // Create stores.yaml registry pointing default store to memory subdirectory
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });
    const registry = { default: { path: memoryDir } };
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok()) {
        throw new Error(`Failed to serialize registry: ${serialized.error.message}`);
    }
    await writeFile(join(testDir, 'stores.yaml'), serialized.value);

    return testDir;
};

const createTestContext = (testDir: string): ToolContext => {
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    
    const cortex = Cortex.init({
        rootDirectory: testDir,
        stores: { default: { path: memoryDir } },
        adapterFactory: (storePath: string) => new FilesystemStorageAdapter({ rootDirectory: storePath }),
    });

    return {
        config: {
            dataPath: testDir,
            port: 3000,
            host: '127.0.0.1',
            defaultStore: 'default',
            logLevel: 'info',
            outputFormat: 'yaml',
            autoSummaryThreshold: 500,
        },
        cortex,
    };
};

describe('cortex_create_category tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new category', async () => {
        const input: CreateCategoryInput = {
            store: 'default',
            path: 'project/cortex',
        };

        const result = await createCategoryHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.path).toBe('project/cortex');
        expect(output.created).toBe(true);
    });

    it('should return created: false for existing category', async () => {
        const input: CreateCategoryInput = { store: 'default', path: 'project/cortex' };

        // Create first time
        await createCategoryHandler(ctx, input);

        // Create again
        const result = await createCategoryHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.created).toBe(false);
    });

    it('should reject empty path', async () => {
        const input = { store: 'default', path: '' };

        await expect(
            createCategoryHandler(ctx, input as CreateCategoryInput),
        ).rejects.toThrow();
    });
});

describe('cortex_set_category_description tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should set description and auto-create category', async () => {
        const input: SetCategoryDescriptionInput = {
            store: 'default',
            path: 'project/cortex',
            description: 'Cortex memory system',
        };

        const result = await setCategoryDescriptionHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBe('Cortex memory system');
    });

    it('should set description on root category', async () => {
        const input: SetCategoryDescriptionInput = {
            store: 'default',
            path: 'project',
            description: 'Root category description',
        };

        const result = await setCategoryDescriptionHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBe('Root category description');
    });

    it('should clear description with empty string', async () => {
        // First set a description
        await setCategoryDescriptionHandler(
            ctx,
            {
                store: 'default',
                path: 'project/cortex',
                description: 'Initial',
            },
        );

        // Then clear it
        const result = await setCategoryDescriptionHandler(
            ctx,
            {
                store: 'default',
                path: 'project/cortex',
                description: '',
            },
        );
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBeNull();
    });

    it('should persist description to index.yaml file', async () => {
        const input: SetCategoryDescriptionInput = {
            store: 'default',
            path: 'test/categories/level1',
            description: 'Test category for runbook validation',
        };

        const result = await setCategoryDescriptionHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBe('Test category for runbook validation');

        // Read the parent index file to verify persistence
        const { readFile } = await import('node:fs/promises');
        const memoryDir = join(testDir, MEMORY_SUBDIR);
        const parentIndexPath = join(memoryDir, 'test', 'categories', 'index.yaml');
        const indexContent = await readFile(parentIndexPath, 'utf8');

        // Verify the description is actually in the file
        expect(indexContent).toContain('Test category for runbook validation');
        expect(indexContent).toContain('description:');
        expect(indexContent).toContain('test/categories/level1');
    });
});

describe('cortex_delete_category tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);

        // Create a category to delete
        await createCategoryHandler(ctx, { store: 'default', path: 'project/deleteme' });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should delete existing category', async () => {
        const input: DeleteCategoryInput = {
            store: 'default',
            path: 'project/deleteme',
        };

        const result = await deleteCategoryHandler(ctx, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.deleted).toBe(true);
    });

    it('should reject root category deletion', async () => {
        const input: DeleteCategoryInput = {
            store: 'default',
            path: 'project',
        };

        await expect(deleteCategoryHandler(ctx, input)).rejects.toThrow(/root category/i);
    });

    it('should reject non-existent category', async () => {
        const input: DeleteCategoryInput = {
            store: 'default',
            path: 'project/nonexistent',
        };

        await expect(deleteCategoryHandler(ctx, input)).rejects.toThrow(/not found/i);
    });
});
