/**
 * Unit tests for MCP category tools.
 *
 * Uses a real temp filesystem via FilesystemStorageAdapter for success-path tests,
 * and mock CortexContext for error-path tests (store resolution failures).
 *
 * @module server/category/tools.spec
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { MEMORY_SUBDIR } from '../config.ts';
import type { CortexContext } from '@yeseh/cortex-core';
import { createTestContext, createTestDir } from '../memory/tools/test-utils.ts';
import {
    createMockCortexContext,
    createMockCortex,
    createMockMcpServer,
    expectMcpInvalidParams,
    errResult,
    type MockCortex,
} from '../test-helpers.spec.ts';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
    registerCategoryTools,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
} from './tools.ts';

type CategoryToolsServer = Parameters<typeof registerCategoryTools>[0];

// =============================================================================
// createCategoryHandler
// =============================================================================

describe('createCategoryHandler', () => {
    describe('store resolution failure', () => {
        it('should throw McpError(InvalidParams) when store does not exist', async () => {
            const ctx = createMockCortexContext({
                cortex: createMockCortex({
                    getStore: mock(() =>
                        errResult({ code: 'STORE_NOT_FOUND', message: 'Store "missing" not found' }),
                    ) as unknown as MockCortex['getStore'],
                }) as unknown as CortexContext['cortex'],
            });

            await expectMcpInvalidParams(
                () => createCategoryHandler(ctx, { store: 'missing', path: 'foo' }),
                'not found',
            );
        });
    });

    describe('input validation', () => {
        it('should throw McpError(InvalidParams) for empty path', async () => {
            // The empty-path guard in the handler fires before the store lookup,
            // so the default mock cortex is fine here.
            const ctx = createMockCortexContext();

            await expectMcpInvalidParams(() =>
                createCategoryHandler(ctx, { store: 'default', path: '' }),
            );
        });

        it('should throw McpError(InvalidParams) for whitespace-only path', async () => {
            const ctx = createMockCortexContext();

            await expectMcpInvalidParams(() =>
                createCategoryHandler(ctx, { store: 'default', path: '   ' }),
            );
        });
    });

    describe('with real filesystem', () => {
        let testDir: string;
        let ctx: CortexContext;

        beforeEach(async () => {
            testDir = await createTestDir();
            ctx = createTestContext(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('should create a new category and return created: true', async () => {
            const input: CreateCategoryInput = { store: 'default', path: 'project/cortex' };

            const result = await createCategoryHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project/cortex');
            expect(output.created).toBe(true);
        });

        it('should return created: false when category already exists', async () => {
            const input: CreateCategoryInput = { store: 'default', path: 'project/cortex' };

            // First creation
            await createCategoryHandler(ctx, input);

            // Second creation — idempotent
            const result = await createCategoryHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project/cortex');
            expect(output.created).toBe(false);
        });

        it('should auto-create intermediate ancestors', async () => {
            const input: CreateCategoryInput = { store: 'default', path: 'a/b/c' };

            const result = await createCategoryHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('a/b/c');
            expect(output.created).toBe(true);
        });

        it('should create a root-level category', async () => {
            const input: CreateCategoryInput = { store: 'default', path: 'toplevel' };

            const result = await createCategoryHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('toplevel');
            expect(output.created).toBe(true);
        });
    });
});

// =============================================================================
// setCategoryDescriptionHandler
// =============================================================================

describe('setCategoryDescriptionHandler', () => {
    describe('store resolution failure', () => {
        it('should throw McpError(InvalidParams) when store does not exist', async () => {
            const ctx = createMockCortexContext({
                cortex: createMockCortex({
                    getStore: mock(() =>
                        errResult({ code: 'STORE_NOT_FOUND', message: 'Store "missing" not found' }),
                    ) as unknown as MockCortex['getStore'],
                }) as unknown as CortexContext['cortex'],
            });

            await expectMcpInvalidParams(
                () =>
                    setCategoryDescriptionHandler(ctx, {
                        store: 'missing',
                        path: 'foo',
                        description: 'hello',
                    }),
                'not found',
            );
        });
    });

    describe('with real filesystem', () => {
        let testDir: string;
        let ctx: CortexContext;

        beforeEach(async () => {
            testDir = await createTestDir();
            ctx = createTestContext(testDir);
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('should set description and return path + description', async () => {
            const input: SetCategoryDescriptionInput = {
                store: 'default',
                path: 'project/cortex',
                description: 'My desc',
            };

            const result = await setCategoryDescriptionHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project/cortex');
            expect(output.description).toBe('My desc');
        });

        it('should auto-create the category when it does not already exist', async () => {
            const input: SetCategoryDescriptionInput = {
                store: 'default',
                path: 'newcat/sub',
                description: 'Auto-created',
            };

            const result = await setCategoryDescriptionHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Auto-created');
        });

        it('should set description on a root category', async () => {
            const input: SetCategoryDescriptionInput = {
                store: 'default',
                path: 'project',
                description: 'Root category description',
            };

            const result = await setCategoryDescriptionHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project');
            expect(output.description).toBe('Root category description');
        });

        it('should clear description when given empty string, returning null', async () => {
            // First set a description
            await setCategoryDescriptionHandler(ctx, {
                store: 'default',
                path: 'project/cortex',
                description: 'Initial description',
            });

            // Then clear it
            const result = await setCategoryDescriptionHandler(ctx, {
                store: 'default',
                path: 'project/cortex',
                description: '',
            });
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project/cortex');
            expect(output.description).toBeNull();
        });

        it('should persist description to parent index.yaml file', async () => {
            const input: SetCategoryDescriptionInput = {
                store: 'default',
                path: 'test/categories/level1',
                description: 'Test category for runbook validation',
            };

            const result = await setCategoryDescriptionHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.description).toBe('Test category for runbook validation');

            // Verify the description is written to the parent index file on disk
            const { readFile } = await import('node:fs/promises');
            const memoryDir = join(testDir, MEMORY_SUBDIR);
            const parentIndexPath = join(memoryDir, 'test', 'categories', 'index.yaml');
            const indexContent = await readFile(parentIndexPath, 'utf8');

            expect(indexContent).toContain('Test category for runbook validation');
            expect(indexContent).toContain('description:');
            expect(indexContent).toContain('test/categories/level1');
        });
    });
});

// =============================================================================
// deleteCategoryHandler
// =============================================================================

describe('deleteCategoryHandler', () => {
    describe('store resolution failure', () => {
        it('should throw McpError(InvalidParams) when store does not exist', async () => {
            const ctx = createMockCortexContext({
                cortex: createMockCortex({
                    getStore: mock(() =>
                        errResult({ code: 'STORE_NOT_FOUND', message: 'Store "missing" not found' }),
                    ) as unknown as MockCortex['getStore'],
                }) as unknown as CortexContext['cortex'],
            });

            await expectMcpInvalidParams(
                () => deleteCategoryHandler(ctx, { store: 'missing', path: 'foo' }),
                'not found',
            );
        });
    });

    describe('with real filesystem', () => {
        let testDir: string;
        let ctx: CortexContext;

        beforeEach(async () => {
            testDir = await createTestDir();
            ctx = createTestContext(testDir);

            // Create a category so we have something to delete in tests
            await createCategoryHandler(ctx, { store: 'default', path: 'project/deleteme' });
        });

        afterEach(async () => {
            await rm(testDir, { recursive: true, force: true });
        });

        it('should delete an existing category and return deleted: true', async () => {
            const input: DeleteCategoryInput = {
                store: 'default',
                path: 'project/deleteme',
            };

            const result = await deleteCategoryHandler(ctx, input);
            const output = JSON.parse(result.content[0]!.text);

            expect(output.path).toBe('project/deleteme');
            expect(output.deleted).toBe(true);
        });

        it('should throw McpError(InvalidParams) when deleting a root (single-segment) category', async () => {
            // Root categories (single segment, e.g. "project") cannot be deleted —
            // the core operation returns ROOT_CATEGORY_REJECTED.
            const input: DeleteCategoryInput = { store: 'default', path: 'project' };

            await expectMcpInvalidParams(() => deleteCategoryHandler(ctx, input));
        });

        it('should throw McpError(InvalidParams) when category does not exist', async () => {
            const input: DeleteCategoryInput = {
                store: 'default',
                path: 'project/nonexistent',
            };

            await expectMcpInvalidParams(() => deleteCategoryHandler(ctx, input));
        });
    });
});

// =============================================================================
// registerCategoryTools
// =============================================================================

describe('registerCategoryTools', () => {
    let ctx: CortexContext;

    beforeEach(() => {
        ctx = createMockCortexContext();
    });

    it('should register all three tools when no options are provided (defaults to free)', () => {
        const { registeredTools, server } = createMockMcpServer();

        registerCategoryTools(server as unknown as CategoryToolsServer, ctx);

        expect(registeredTools.has('cortex_create_category')).toBe(true);
        expect(registeredTools.has('cortex_set_category_description')).toBe(true);
        expect(registeredTools.has('cortex_delete_category')).toBe(true);
    });

    it('should register all three tools in free mode', () => {
        const { registeredTools, server } = createMockMcpServer();

        registerCategoryTools(server as unknown as CategoryToolsServer, ctx, { mode: 'free' });

        expect(registeredTools.has('cortex_create_category')).toBe(true);
        expect(registeredTools.has('cortex_set_category_description')).toBe(true);
        expect(registeredTools.has('cortex_delete_category')).toBe(true);
        expect(registeredTools.size).toBe(3);
    });

    it('should register all three tools in subcategories mode', () => {
        const { registeredTools, server } = createMockMcpServer();

        registerCategoryTools(server as unknown as CategoryToolsServer, ctx, {
            mode: 'subcategories',
            configCategories: { standards: {}, projects: {} },
        });

        expect(registeredTools.has('cortex_create_category')).toBe(true);
        expect(registeredTools.has('cortex_set_category_description')).toBe(true);
        expect(registeredTools.has('cortex_delete_category')).toBe(true);
        expect(registeredTools.size).toBe(3);
    });

    it('should register only cortex_set_category_description in strict mode', () => {
        const { registeredTools, server } = createMockMcpServer();

        registerCategoryTools(server as unknown as CategoryToolsServer, ctx, {
            mode: 'strict',
            configCategories: { standards: {}, projects: {} },
        });

        expect(registeredTools.has('cortex_set_category_description')).toBe(true);
        expect(registeredTools.has('cortex_create_category')).toBe(false);
        expect(registeredTools.has('cortex_delete_category')).toBe(false);
        expect(registeredTools.size).toBe(1);
    });

    it('should attach non-empty descriptions to all registered tools', () => {
        const { registeredTools, server } = createMockMcpServer();

        registerCategoryTools(server as unknown as CategoryToolsServer, ctx);

        const createTool = registeredTools.get('cortex_create_category');
        const deleteTool = registeredTools.get('cortex_delete_category');
        const descTool = registeredTools.get('cortex_set_category_description');

        expect(createTool?.description).toBeTruthy();
        expect(deleteTool?.description).toBeTruthy();
        expect(descTool?.description).toBeTruthy();
    });
});
