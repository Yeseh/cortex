import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { err } from '@yeseh/cortex-core';
import {
    storeNameSchema,
    listStores,
    listStoresFromContext,
    listStoresHandler,
    createStoreHandler,
} from './tools.ts';
import { createMockCortexContext, parseResponseJson } from '../test-helpers.spec.ts';

describe('storeNameSchema', () => {
    describe('valid names', () => {
        it('should accept "default"', () => {
            const result = storeNameSchema.safeParse('default');
            expect(result.success).toBe(true);
        });

        it('should accept "my-store"', () => {
            const result = storeNameSchema.safeParse('my-store');
            expect(result.success).toBe(true);
        });

        it('should accept "store_1"', () => {
            const result = storeNameSchema.safeParse('store_1');
            expect(result.success).toBe(true);
        });

        it('should accept "A123"', () => {
            const result = storeNameSchema.safeParse('A123');
            expect(result.success).toBe(true);
        });

        it('should accept single alphanumeric character', () => {
            const result = storeNameSchema.safeParse('a');
            expect(result.success).toBe(true);
        });

        it('should accept numeric start character', () => {
            const result = storeNameSchema.safeParse('1store');
            expect(result.success).toBe(true);
        });

        it('should accept mixed case with hyphens and underscores', () => {
            const result = storeNameSchema.safeParse('My-Store_V2');
            expect(result.success).toBe(true);
        });
    });

    describe('invalid names', () => {
        it('should reject empty string', () => {
            const result = storeNameSchema.safeParse('');
            expect(result.success).toBe(false);
            if (!result.success) {
                // Empty string fails both min length and regex checks
                expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
                // The first issue should be the min length error
                expect(result.error.issues[0]?.message).toBe('Store name must not be empty');
            }
        });

        it('should reject names starting with hyphen', () => {
            const result = storeNameSchema.safeParse('-store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric'
                );
            }
        });

        it('should reject names starting with underscore', () => {
            const result = storeNameSchema.safeParse('_store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric'
                );
            }
        });

        it('should reject names with spaces', () => {
            const result = storeNameSchema.safeParse('my store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric'
                );
            }
        });

        it('should reject names with @ symbol', () => {
            const result = storeNameSchema.safeParse('store@1');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric'
                );
            }
        });

        it('should reject names with dots', () => {
            const result = storeNameSchema.safeParse('store.name');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric'
                );
            }
        });

        it('should reject names with slashes', () => {
            const result = storeNameSchema.safeParse('store/name');
            expect(result.success).toBe(false);
        });

        it('should reject names with backslashes', () => {
            const result = storeNameSchema.safeParse('store\\name');
            expect(result.success).toBe(false);
        });
    });
});

describe('listStores', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-test-'));
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should return empty array when data path does not exist', async () => {
        const nonExistentPath = path.join(testDir, 'non-existent');
        const result = await listStores(nonExistentPath);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual([]);
        }
    });

    it('should return empty array when data path is empty', async () => {
        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual([]);
        }
    });

    it('should return store names from directory', async () => {
        // Create some store directories
        await fs.mkdir(path.join(testDir, 'store-a'));
        await fs.mkdir(path.join(testDir, 'store-b'));
        await fs.mkdir(path.join(testDir, 'default'));

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toHaveLength(3);
            expect(result.value).toContain('store-a');
            expect(result.value).toContain('store-b');
            expect(result.value).toContain('default');
        }
    });

    it('should only return directories, not files', async () => {
        // Create a mix of files and directories
        await fs.mkdir(path.join(testDir, 'real-store'));
        await fs.writeFile(path.join(testDir, 'not-a-store.txt'), 'content');
        await fs.writeFile(path.join(testDir, 'another-file'), 'content');

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual(['real-store']);
        }
    });

    it('should return STORE_LIST_FAILED error when path is a file, not a directory', async () => {
        const filePath = path.join(testDir, 'not-a-directory');
        await fs.writeFile(filePath, 'content');

        const result = await listStores(filePath);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_LIST_FAILED');
            expect(result.error.message).toContain('Failed to list stores');
        }
    });

    it('should handle multiple stores with different naming conventions', async () => {
        await fs.mkdir(path.join(testDir, 'project-alpha'));
        await fs.mkdir(path.join(testDir, 'project_beta'));
        await fs.mkdir(path.join(testDir, 'Project123'));

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toHaveLength(3);
            expect(result.value).toContain('project-alpha');
            expect(result.value).toContain('project_beta');
            expect(result.value).toContain('Project123');
        }
    });
});

// ---------------------------------------------------------------------------
// listStoresFromContext
// ---------------------------------------------------------------------------

describe('listStoresFromContext', () => {
    it('should return ok result with empty stores array when ctx.stores is empty', () => {
        const ctx = createMockCortexContext({ stores: {} });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toEqual([]);
        }
    });

    it('should return ok result on success', () => {
        const ctx = createMockCortexContext({
            stores: {
                'my-store': {
                    kind: 'filesystem',
                    properties: { path: '/tmp/my-store' },
                    categories: {},
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
    });

    it('should map path from definition.properties.path', () => {
        const ctx = createMockCortexContext({
            stores: {
                alpha: {
                    kind: 'filesystem',
                    properties: { path: '/data/alpha' },
                    categories: {},
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores[0]?.path).toBe('/data/alpha');
        }
    });

    it('should include description when present on the definition', () => {
        const ctx = createMockCortexContext({
            stores: {
                documented: {
                    kind: 'filesystem',
                    properties: { path: '/data/documented' },
                    description: 'A well documented store',
                    categories: {},
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores[0]?.description).toBe('A well documented store');
        }
    });

    it('should NOT include description key when description is undefined', () => {
        const ctx = createMockCortexContext({
            stores: {
                nodesc: {
                    kind: 'filesystem',
                    properties: { path: '/data/nodesc' },
                    categories: {},
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect('description' in (result.value.stores[0] ?? {})).toBe(false);
        }
    });

    it('should default categoryMode to "free" when undefined on the definition', () => {
        const ctx = createMockCortexContext({
            stores: {
                freestore: {
                    kind: 'filesystem',
                    properties: { path: '/data/freestore' },
                    categories: {},
                    // categoryMode intentionally omitted
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores[0]?.categoryMode).toBe('free');
        }
    });

    it('should use categoryMode from definition when explicitly set', () => {
        const ctx = createMockCortexContext({
            stores: {
                strictstore: {
                    kind: 'filesystem',
                    properties: { path: '/data/strictstore' },
                    categoryMode: 'strict',
                    categories: {},
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores[0]?.categoryMode).toBe('strict');
        }
    });

    it('should sort stores alphabetically by name', () => {
        const ctx = createMockCortexContext({
            stores: {
                zebra: { kind: 'filesystem', properties: { path: '/data/zebra' }, categories: {} },
                alpha: { kind: 'filesystem', properties: { path: '/data/alpha' }, categories: {} },
                mango: { kind: 'filesystem', properties: { path: '/data/mango' }, categories: {} },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const names = result.value.stores.map((s) => s.name);
            expect(names).toEqual(['alpha', 'mango', 'zebra']);
        }
    });

    it('should return a StoreInfo with a categories array', () => {
        const ctx = createMockCortexContext({
            stores: {
                withcats: {
                    kind: 'filesystem',
                    properties: { path: '/data/withcats' },
                    categories: {
                        standards: { description: 'Coding standards' },
                    },
                },
            },
        });
        const result = listStoresFromContext(ctx);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const store = result.value.stores[0];
            expect(Array.isArray(store?.categories)).toBe(true);
            expect(store?.categories).toHaveLength(1);
            expect(store?.categories[0]?.path).toBe('standards');
        }
    });
});

// ---------------------------------------------------------------------------
// listStoresHandler
// ---------------------------------------------------------------------------

describe('listStoresHandler', () => {
    it('should return JSON text response with a "stores" key', async () => {
        const ctx = createMockCortexContext({ stores: {} });
        const response = await listStoresHandler(ctx);

        expect(response.content).toHaveLength(1);
        expect(response.content[0]?.type).toBe('text');
        const data = parseResponseJson(response) as { stores: unknown[] };
        expect(data).toHaveProperty('stores');
    });

    it('should return stores as an array', async () => {
        const ctx = createMockCortexContext({ stores: {} });
        const response = await listStoresHandler(ctx);

        const data = parseResponseJson(response) as { stores: unknown[] };
        expect(Array.isArray(data.stores)).toBe(true);
    });

    it('should return empty array when no stores are registered', async () => {
        const ctx = createMockCortexContext({ stores: {} });
        const response = await listStoresHandler(ctx);

        const data = parseResponseJson(response) as { stores: unknown[] };
        expect(data.stores).toHaveLength(0);
    });

    it('should return all registered stores', async () => {
        const ctx = createMockCortexContext({
            stores: {
                'store-a': {
                    kind: 'filesystem',
                    properties: { path: '/data/store-a' },
                    categories: {},
                },
                'store-b': {
                    kind: 'filesystem',
                    properties: { path: '/data/store-b' },
                    categories: {},
                },
            },
        });
        const response = await listStoresHandler(ctx);

        const data = parseResponseJson(response) as { stores: { name: string }[] };
        expect(data.stores).toHaveLength(2);
        const names = data.stores.map((s) => s.name);
        expect(names).toContain('store-a');
        expect(names).toContain('store-b');
    });

    it('should return stores sorted alphabetically', async () => {
        const ctx = createMockCortexContext({
            stores: {
                zebra: { kind: 'filesystem', properties: { path: '/data/zebra' }, categories: {} },
                alpha: { kind: 'filesystem', properties: { path: '/data/alpha' }, categories: {} },
            },
        });
        const response = await listStoresHandler(ctx);

        const data = parseResponseJson(response) as { stores: { name: string }[] };
        const names = data.stores.map((s) => s.name);
        expect(names).toEqual(['alpha', 'zebra']);
    });

    it('should not set isError on the response', async () => {
        const ctx = createMockCortexContext({ stores: {} });
        const response = await listStoresHandler(ctx);

        expect(response.isError).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// createStoreHandler
// ---------------------------------------------------------------------------

describe('createStoreHandler', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-store-create-'));
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should return errorResponse when name is empty string', async () => {
        const ctx = createMockCortexContext({ stores: {}, globalDataPath: testDir });
        const response = await createStoreHandler(ctx, { name: '' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('invalid');
    });

    it('should return errorResponse when name contains spaces', async () => {
        const ctx = createMockCortexContext({ stores: {}, globalDataPath: testDir });
        const response = await createStoreHandler(ctx, { name: 'my store with spaces' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('invalid');
    });

    it('should return errorResponse when name starts with a hyphen', async () => {
        const ctx = createMockCortexContext({ stores: {}, globalDataPath: testDir });
        const response = await createStoreHandler(ctx, { name: '-invalid' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('invalid');
    });

    it('should return errorResponse when name contains special characters', async () => {
        const ctx = createMockCortexContext({ stores: {}, globalDataPath: testDir });
        const response = await createStoreHandler(ctx, { name: 'store@name' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('invalid');
    });

    it('should return errorResponse when store already exists in ctx.stores', async () => {
        const ctx = createMockCortexContext({
            globalDataPath: testDir,
            stores: {
                'existing-store': {
                    kind: 'filesystem',
                    properties: { path: path.join(testDir, 'existing-store') },
                    categories: {},
                },
            },
        });
        const response = await createStoreHandler(ctx, { name: 'existing-store' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('already exists');
    });

    it('should return errorResponse when globalDataPath is undefined', async () => {
        const ctx = createMockCortexContext({
            stores: {},
            globalDataPath: undefined,
        });

        const response = await createStoreHandler(ctx, { name: 'new-store' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('globalDataPath');
    });

    it('should return errorResponse when saveStore fails', async () => {
        const ctx = createMockCortexContext({
            stores: {},
            globalDataPath: testDir,
        });
        (ctx.config.saveStore as ReturnType<typeof mock>).mockImplementation(async () =>
            err({ code: 'CONFIG_WRITE_FAILED' as const, message: 'disk full' })
        );

        const response = await createStoreHandler(ctx, { name: 'new-store' });

        expect(response.isError).toBe(true);
        expect(response.content[0]?.text).toContain('Failed to register');
    });

    it('should return textResponse with created name on success', async () => {
        const ctx = createMockCortexContext({
            stores: {},
            globalDataPath: testDir,
        });

        const response = await createStoreHandler(ctx, { name: 'brand-new-store' });

        expect(response.isError).toBeUndefined();
        const data = parseResponseJson(response) as { created: string };
        expect(data.created).toBe('brand-new-store');
    });

    it('should create the store directory on disk on success', async () => {
        const ctx = createMockCortexContext({
            stores: {},
            globalDataPath: testDir,
        });

        await createStoreHandler(ctx, { name: 'disk-store' });

        const stat = await fs.stat(path.join(testDir, 'disk-store'));
        expect(stat.isDirectory()).toBe(true);
    });

    it('should call config.saveStore with the correct StoreData', async () => {
        const ctx = createMockCortexContext({
            stores: {},
            globalDataPath: testDir,
        });

        await createStoreHandler(ctx, { name: 'checked-store' });

        expect(ctx.config.saveStore).toHaveBeenCalledTimes(1);
        const callArgs = (ctx.config.saveStore as ReturnType<typeof mock>).mock.calls[0] as [
            string,
            { properties: { path: string }; kind: string },
        ];
        expect(callArgs[0]).toBe('checked-store');
        const storeData = callArgs[1]!;
        expect(storeData.kind).toBe('filesystem');
        expect(storeData.properties.path).toBe(path.join(testDir, 'checked-store'));
    });
});
