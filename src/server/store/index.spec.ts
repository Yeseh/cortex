import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStoreTools } from './index.ts';
import type { ServerConfig } from '../config.ts';

// Type for accessing private MCP server internals
interface RegisteredToolHandler {
    handler: (
        args: Record<string, unknown>,
        extra: unknown,
    ) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
}

// Helper to access private _registeredTools (which is an object, not a Map)
const getRegisteredTools = (server: McpServer): Record<string, RegisteredToolHandler> => {
    return (server as unknown as { _registeredTools: Record<string, RegisteredToolHandler> })
        ._registeredTools;
};

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
            autoSummaryThreshold: 500,
        };
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('registerStoreTools function', () => {
        it('should register both tools without throwing', () => {
            expect(() => registerStoreTools(server, config)).not.toThrow();
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

            registerStoreTools(server, config);

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

            registerStoreTools(server, config);

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

            registerStoreTools(server, config);

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

            registerStoreTools(server, config);

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

            registerStoreTools(server, config);

            expect(createStoreConfig?.inputSchema).toBeDefined();
            expect(createStoreConfig?.inputSchema?.name).toBeDefined();
        });
    });

    describe('integration with MCP server', () => {
        it('should execute list_stores tool and return valid response when no stores exist', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const listStoresTool = registeredTools['cortex_list_stores'];

            expect(listStoresTool).toBeDefined();

            const result = await listStoresTool!.handler({}, {});

            expect(result).toHaveProperty('content');
            expect(result.content).toHaveLength(1);
            expect(result.content[0]?.type).toBe('text');

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed).toHaveProperty('stores');
            expect(parsed.stores).toEqual([]);
        });

        it('should execute list_stores tool and return stores when stores exist', async () => {
            // Create a stores.yaml registry with store entries
            const registryContent = [
                'stores:',
                '  store-a:',
                '    path: "/data/store-a"',
                '  store-b:',
                '    path: "/data/store-b"',
            ].join('\n');
            await fs.writeFile(path.join(testDir, 'stores.yaml'), registryContent);

            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const listStoresTool = registeredTools['cortex_list_stores'];

            const result = await listStoresTool!.handler({}, {});

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed.stores).toHaveLength(2);
            expect(parsed.stores.map((s: { name: string }) => s.name)).toContain('store-a');
            expect(parsed.stores.map((s: { name: string }) => s.name)).toContain('store-b');
        });

        it('should execute create_store tool with valid name and create store', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            expect(createStoreTool).toBeDefined();

            const result = await createStoreTool!.handler({ name: 'my-new-store' }, {});

            expect(result).toHaveProperty('content');
            expect(result.isError).toBeUndefined();

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed).toHaveProperty('created', 'my-new-store');

            // Verify the store directory was created
            const stat = await fs.stat(path.join(testDir, 'my-new-store'));
            expect(stat.isDirectory()).toBe(true);
        });

        it('should execute create_store tool with invalid name and return error', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: '-invalid-name' }, {});

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('Store name must start with alphanumeric');
        });

        it('should execute create_store tool with empty name and return error', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: '' }, {});

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('Store name must not be empty');
        });

        it('should execute create_store tool with existing store name and return error', async () => {
            // Create an existing store
            await fs.mkdir(path.join(testDir, 'existing-store'));

            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: 'existing-store' }, {});

            expect(result).toHaveProperty('content');
            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
            expect(result.content[0]?.text).toContain('already exists');
        });

        it('should return error from list_stores when registry is malformed', async () => {
            // Create a malformed stores.yaml
            await fs.writeFile(path.join(testDir, 'stores.yaml'), 'not valid yaml: [');

            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const listStoresTool = registeredTools['cortex_list_stores'];

            const result = await listStoresTool!.handler({}, {});

            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
        });
    });

    describe('tool handler behavior', () => {
        it('should return JSON formatted response from list_stores', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const listStoresTool = registeredTools['cortex_list_stores'];

            const result = await listStoresTool!.handler({}, {});

            // Verify the response is valid JSON
            expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
        });

        it('should return JSON formatted response from create_store', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: 'test-store' }, {});

            // Verify the response is valid JSON
            expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
        });

        it('should create store with special valid characters in name', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: 'My-Store_V2' }, {});

            expect(result.isError).toBeUndefined();

            const parsed = JSON.parse(result.content[0]!.text);
            expect(parsed.created).toBe('My-Store_V2');

            // Verify the store was created
            const stat = await fs.stat(path.join(testDir, 'My-Store_V2'));
            expect(stat.isDirectory()).toBe(true);
        });

        it('should handle name with special invalid characters', async () => {
            registerStoreTools(server, config);

            const registeredTools = getRegisteredTools(server);
            const createStoreTool = registeredTools['cortex_create_store'];

            const result = await createStoreTool!.handler({ name: 'store@name' }, {});

            expect(result.isError).toBe(true);
            expect(result.content[0]?.text).toContain('Error:');
        });
    });
});
