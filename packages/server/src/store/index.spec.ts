import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import {
    ok,
    storeCategoriesToConfigCategories,
    type ConfigAdapter,
    type ConfigStores,
    type StoreData,
} from '@yeseh/cortex-core';
import { testContext } from '../../../core/src/testing/createContext.ts';
import { registerStoreTools } from './index.ts';
import { listStoresHandler, createStoreHandler } from './tools.ts';
import type { ServerConfig } from '../config.ts';
import type { CortexContext } from '@yeseh/cortex-core';

describe('store tool registration', () => {
    let server: McpServer;
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        server = new McpServer({ name: 'test-server', version: '1.0.0' });
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-test-'));
        config = {
            dataPath: testDir,
            port: 3000,
            host: '127.0.0.1',
            defaultStore: 'default',
            logLevel: 'info',
            outputFormat: 'yaml',
        };
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    const createInMemoryConfigAdapter = (initialStores: ConfigStores): ConfigAdapter => {
        const stores: ConfigStores = { ...initialStores };

        return {
            path: path.join(testDir, 'config.yaml'),
            data: null,
            stores,
            settings: {},
            initializeConfig: async () => ok(undefined),
            getSettings: async () => ok({}),
            getStores: async () => ok(stores),
            getStore: async (storeName: string) => ok(stores[storeName] ?? null),
            saveStore: async (storeName: string, data: StoreData) => {
                stores[storeName] = {
                    kind: data.kind,
                    categoryMode: data.categoryMode,
                    description: data.description,
                    categories: storeCategoriesToConfigCategories(data.categories),
                    properties: data.properties,
                };
                return ok(undefined);
            },
        };
    };

    // Helper to create a CortexContext with actual Cortex instance
    const createTestCortexContext = (registry: ConfigStores = {}): CortexContext => {
        const configAdapter = createInMemoryConfigAdapter(registry);
        const adapter = new FilesystemStorageAdapter(configAdapter, { rootDirectory: testDir });
        const ctx = testContext({ adapter, storePath: testDir, stores: registry, settings: {} });
        return { ...ctx, config, globalDataPath: testDir } as unknown as CortexContext;
    };

    describe('registerStoreTools function', () => {
        it('should register both tools without throwing', () => {
            expect(() => registerStoreTools(server, createTestCortexContext())).not.toThrow();
        });

        it('should call registerTool with cortex_list_stores', () => {
            const registerToolCalls: string[] = [];
            const originalRegisterTool = server.registerTool.bind(server);

            spyOn(server, 'registerTool').mockImplementation(
                (name: string, configArg: unknown, cb: unknown) => {
                    registerToolCalls.push(name);
                    return originalRegisterTool(
                        name,
                        configArg as Parameters<typeof originalRegisterTool>[1],
                        cb as Parameters<typeof originalRegisterTool>[2],
                    );
                },
            );

            registerStoreTools(server, createTestCortexContext());

            expect(registerToolCalls).toContain('cortex_list_stores');
        });

        it('should call registerTool with cortex_create_store', () => {
            const registerToolCalls: string[] = [];
            const originalRegisterTool = server.registerTool.bind(server);

            spyOn(server, 'registerTool').mockImplementation(
                (name: string, configArg: unknown, cb: unknown) => {
                    registerToolCalls.push(name);
                    return originalRegisterTool(
                        name,
                        configArg as Parameters<typeof originalRegisterTool>[1],
                        cb as Parameters<typeof originalRegisterTool>[2],
                    );
                },
            );

            registerStoreTools(server, createTestCortexContext());

            expect(registerToolCalls).toContain('cortex_create_store');
        });

        it('should register exactly two tools', () => {
            const registerToolCalls: string[] = [];
            const originalRegisterTool = server.registerTool.bind(server);

            spyOn(server, 'registerTool').mockImplementation(
                (name: string, configArg: unknown, cb: unknown) => {
                    registerToolCalls.push(name);
                    return originalRegisterTool(
                        name,
                        configArg as Parameters<typeof originalRegisterTool>[1],
                        cb as Parameters<typeof originalRegisterTool>[2],
                    );
                },
            );

            registerStoreTools(server, createTestCortexContext());

            expect(registerToolCalls).toHaveLength(2);
        });

        it('should register tools with descriptions', () => {
            const registeredDescriptions: { name: string; description: string }[] = [];
            const originalRegisterTool = server.registerTool.bind(server);

            spyOn(server, 'registerTool').mockImplementation(
                (name: string, configArg: unknown, cb: unknown) => {
                    const toolConfig = configArg as { description?: string };
                    if (toolConfig?.description) {
                        registeredDescriptions.push({ name, description: toolConfig.description });
                    }
                    return originalRegisterTool(
                        name,
                        configArg as Parameters<typeof originalRegisterTool>[1],
                        cb as Parameters<typeof originalRegisterTool>[2],
                    );
                },
            );

            registerStoreTools(server, createTestCortexContext());

            const listStoresTool = registeredDescriptions.find(
                (t) => t.name === 'cortex_list_stores',
            );
            const createStoreTool = registeredDescriptions.find(
                (t) => t.name === 'cortex_create_store',
            );

            expect(listStoresTool?.description).toBe('List all available memory stores');
            expect(createStoreTool?.description).toBe('Create a new memory store');
        });

        it('should register create_store with input schema containing name field', () => {
            let createStoreConfig: { inputSchema?: Record<string, unknown> } | undefined;
            const originalRegisterTool = server.registerTool.bind(server);

            spyOn(server, 'registerTool').mockImplementation(
                (name: string, configArg: unknown, cb: unknown) => {
                    if (name === 'cortex_create_store') {
                        createStoreConfig = configArg as { inputSchema?: Record<string, unknown> };
                    }
                    return originalRegisterTool(
                        name,
                        configArg as Parameters<typeof originalRegisterTool>[1],
                        cb as Parameters<typeof originalRegisterTool>[2],
                    );
                },
            );

            registerStoreTools(server, createTestCortexContext());

            expect(createStoreConfig?.inputSchema).toBeDefined();
            expect(createStoreConfig?.inputSchema?.name).toBeDefined();
        });
    });

    describe('listStoresHandler', () => {
        it('should return valid response when no stores exist', async () => {
            const ctx = createTestCortexContext();

            const result = await listStoresHandler(ctx);

            expect(result).toHaveProperty('content');
            expect(result.content).toHaveLength(1);
            expect(result.content[0]?.type).toBe('text');

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed).toHaveProperty('stores');
            expect(parsed.stores).toEqual([]);
        });

        it('should return stores when stores exist', async () => {
            // Create a context with stores in the registry
            const ctx = createTestCortexContext({
                'store-a': {
                    kind: 'filesystem',
                    categories: {},
                    properties: { path: '/data/store-a' },
                },
                'store-b': {
                    kind: 'filesystem',
                    categories: {},
                    properties: { path: '/data/store-b' },
                },
            });

            const result = await listStoresHandler(ctx);

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed.stores).toHaveLength(2);
            expect(parsed.stores.map((s: { name: string }) => s.name)).toContain('store-a');
            expect(parsed.stores.map((s: { name: string }) => s.name)).toContain('store-b');
        });

        it('should return JSON formatted response', async () => {
            const ctx = createTestCortexContext();

            const result = await listStoresHandler(ctx);

            // Verify the response is valid JSON
            expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
        });
    });

    describe('createStoreHandler', () => {
        it('should create store with valid name', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: 'my-new-store' });

            expect(result).toHaveProperty('content');
            expect(result.isError).toBeUndefined();

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed).toHaveProperty('created', 'my-new-store');

            // Verify the store directory was created
            const stat = await fs.stat(path.join(testDir, 'my-new-store'));
            expect(stat.isDirectory()).toBe(true);
        });

        it('should return error with invalid name (starts with hyphen)', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: '-invalid-name' });

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('invalid');
        });

        it('should return error with empty name', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: '' });

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('invalid');
        });

        it('should return error with existing store name', async () => {
            // Create a registry with an existing store entry
            const ctx = createTestCortexContext({
                'existing-store': {
                    kind: 'filesystem',
                    categories: {},
                    properties: { path: path.join(testDir, 'existing-store') },
                },
            });

            const result = await createStoreHandler(ctx, { name: 'existing-store' });

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('already');
        });

        it('should return JSON formatted response', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: 'test-store' });

            // Verify the response is valid JSON
            expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
        });

        it('should create store with kebab-case name', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: 'my-store-v2' });

            expect(result.isError).toBeUndefined();

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed.created).toBe('my-store-v2');

            // Verify the store was created
            const stat = await fs.stat(path.join(testDir, 'my-store-v2'));
            expect(stat.isDirectory()).toBe(true);
        });

        it('should return error with special invalid characters', async () => {
            const ctx = createTestCortexContext();

            const result = await createStoreHandler(ctx, { name: 'store@name' });

            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
        });
    });
});
