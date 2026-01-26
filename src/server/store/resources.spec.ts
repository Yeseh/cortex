import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { registerStoreResources } from './resources.ts';
import type { ServerConfig } from '../config.ts';

// Type for accessing private MCP server internals for resources
type ResourceReadCallback = (
    uri: URL,
    variables: Record<string, string | string[]>,
) => Promise<{
    contents: { uri: string; mimeType: string; text: string }[];
}>;

interface ResourceTemplateCallbacks {
    list?: () => Promise<{
        resources: { uri: string; name: string; mimeType: string }[];
    }>;
    complete?: {
        name?: () => Promise<string[]>;
    };
}

interface ResourceTemplateEntry {
    resourceTemplate: {
        _callbacks: ResourceTemplateCallbacks;
        _uriTemplate: { template: string };
    };
    readCallback: ResourceReadCallback;
}

interface ResourceEntry {
    readCallback: ResourceReadCallback;
}

interface McpServerInternals {
    _registeredResources: Record<string, ResourceEntry>;
    _registeredResourceTemplates: Record<string, ResourceTemplateEntry>;
}

// Helper to access private _registeredResources (keyed by URI)
const getRegisteredResources = (server: McpServer): Record<string, ResourceEntry> => {
    return (server as unknown as McpServerInternals)._registeredResources; 
};

// Helper to access private _registeredResourceTemplates (keyed by name)
const getRegisteredResourceTemplates = (server: McpServer): Record<string, ResourceTemplateEntry> => {
    return (server as unknown as McpServerInternals)._registeredResourceTemplates; 
};

describe(
    'Store Resources', () => {
        let server: McpServer;
        let testDir: string;
        let config: ServerConfig;

        beforeEach(async () => {
            server = new McpServer({ name: 'test-server', version: '1.0.0' });
            testDir = await fs.mkdtemp(path.join(
                os.tmpdir(), 'cortex-test-',
            ));
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
            await fs.rm(
                testDir, { recursive: true, force: true },
            ); 
        });

        describe(
            'registerStoreResources function', () => {
                it(
                    'should register resources without throwing', () => {
                        expect(() => registerStoreResources(
                            server, config,
                        )).not.toThrow(); 
                    },
                );

                it(
                    'should call server.registerResource with store-list', () => {
                        const resourceCalls: string[] = [];
                        const originalRegisterResource = server.registerResource.bind(server);

                        spyOn(
                            server, 'registerResource',
                        ).mockImplementation((
                            name: string, ...args: any[]
                        ) => {
                            resourceCalls.push(name);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            return (originalRegisterResource as any)(
                                name, ...args,
                            );
                        });

                        registerStoreResources(
                            server, config,
                        );

                        expect(resourceCalls).toContain('store-list');
                    },
                );

                it(
                    'should call server.registerResource with store-detail', () => {
                        const resourceCalls: string[] = [];
                        const originalRegisterResource = server.registerResource.bind(server);

                        spyOn(
                            server, 'registerResource',
                        ).mockImplementation((
                            name: string, ...args: any[]
                        ) => {
                            resourceCalls.push(name);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            return (originalRegisterResource as any)(
                                name, ...args,
                            );
                        });

                        registerStoreResources(
                            server, config,
                        );

                        expect(resourceCalls).toContain('store-detail');
                    },
                );

                it(
                    'should register exactly two resources', () => {
                        const resourceCalls: string[] = [];
                        const originalRegisterResource = server.registerResource.bind(server);

                        spyOn(
                            server, 'registerResource',
                        ).mockImplementation((
                            name: string, ...args: any[]
                        ) => {
                            resourceCalls.push(name);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            return (originalRegisterResource as any)(
                                name, ...args,
                            );
                        });

                        registerStoreResources(
                            server, config,
                        );

                        expect(resourceCalls).toHaveLength(2);
                    },
                );
            },
        );

        describe(
            'Store List Resource (cortex://store/)', () => {
                it(
                    'should return list of all stores when stores exist', async () => {
                        // Create some store directories
                        await fs.mkdir(path.join(
                            testDir, 'store-a',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'store-b',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'default',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        expect(storeListResource).toBeDefined();

                        const result = await storeListResource!.readCallback(
                            new URL('cortex://store/'), {},
                        );

                        expect(result).toHaveProperty('contents');
                        expect(result.contents).toHaveLength(1);
                        expect(result.contents[0]?.uri).toBe('cortex://store/');
                        expect(result.contents[0]?.mimeType).toBe('application/json');

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed).toHaveProperty('stores');
                        expect(parsed.stores).toHaveLength(3);
                        expect(parsed.stores).toContain('store-a');
                        expect(parsed.stores).toContain('store-b');
                        expect(parsed.stores).toContain('default');
                    },
                );

                it(
                    'should return empty list when no stores exist', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        const result = await storeListResource!.readCallback(
                            new URL('cortex://store/'), {},
                        );

                        expect(result.contents).toHaveLength(1);

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed).toHaveProperty('stores');
                        expect(parsed.stores).toEqual([]);
                    },
                );

                it(
                    'should throw McpError when data path is inaccessible', async () => {
                        // Create a file instead of a directory to cause an error
                        const filePath = path.join(
                            testDir, 'not-a-directory',
                        );
                        await fs.writeFile(
                            filePath, 'content',
                        );

                        const invalidConfig: ServerConfig = {
                            ...config,
                            dataPath: filePath,
                        };

                        registerStoreResources(
                            server, invalidConfig,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        await expect(async () => {
                            await storeListResource!.readCallback(
                                new URL('cortex://store/'), {},
                            ); 
                        }).toThrow(McpError);
                    },
                );

                it(
                    'should return JSON with correct MIME type', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        const result = await storeListResource!.readCallback(
                            new URL('cortex://store/'), {},
                        );

                        expect(result.contents[0]?.mimeType).toBe('application/json');
                        // Verify valid JSON
                        expect(() => JSON.parse(result.contents[0]!.text)).not.toThrow();
                    },
                );

                it(
                    'should only return directories, not files', async () => {
                        // Create a mix of files and directories
                        await fs.mkdir(path.join(
                            testDir, 'real-store',
                        ));
                        await fs.writeFile(
                            path.join(
                                testDir, 'not-a-store.txt',
                            ), 'content',
                        );

                        registerStoreResources(
                            server, config,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        const result = await storeListResource!.readCallback(
                            new URL('cortex://store/'), {},
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.stores).toEqual(['real-store']);
                    },
                );
            },
        );

        describe(
            'Store Detail Resource (cortex://store/{name})', () => {
                it(
                    'should return store metadata and categories for valid store', async () => {
                        // Create store with categories
                        await fs.mkdir(path.join(
                            testDir, 'my-store',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'my-store', 'category-a',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'my-store', 'category-b',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        expect(storeDetailResource).toBeDefined();

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/my-store'),
                            { name: 'my-store' },
                        );

                        expect(result).toHaveProperty('contents');
                        expect(result.contents).toHaveLength(1);
                        expect(result.contents[0]?.mimeType).toBe('application/json');

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed).toHaveProperty(
                            'name', 'my-store',
                        );
                        expect(parsed).toHaveProperty('categories');
                        expect(parsed.categories).toHaveLength(2);
                        expect(parsed.categories).toContain('category-a');
                        expect(parsed.categories).toContain('category-b');
                    },
                );

                it(
                    'should return categories list for store with subdirectories', async () => {
                        // Create store with nested subdirectories
                        await fs.mkdir(path.join(
                            testDir, 'project-store',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'project-store', 'docs',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'project-store', 'code',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'project-store', 'tests',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/project-store'),
                            { name: 'project-store' },
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.categories).toHaveLength(3);
                        expect(parsed.categories).toContain('docs');
                        expect(parsed.categories).toContain('code');
                        expect(parsed.categories).toContain('tests');
                    },
                );

                it(
                    'should return empty categories for store with no subdirectories', async () => {
                        // Create empty store
                        await fs.mkdir(path.join(
                            testDir, 'empty-store',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/empty-store'),
                            { name: 'empty-store' },
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.name).toBe('empty-store');
                        expect(parsed.categories).toEqual([]);
                    },
                );

                it(
                    'should return empty categories when store contains only files', async () => {
                        // Create store with only files
                        await fs.mkdir(path.join(
                            testDir, 'files-only-store',
                        ));
                        await fs.writeFile(
                            path.join(
                                testDir, 'files-only-store', 'file1.txt',
                            ), 'content',
                        );
                        await fs.writeFile(
                            path.join(
                                testDir, 'files-only-store', 'file2.md',
                            ), 'content',
                        );

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/files-only-store'),
                            { name: 'files-only-store' },
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.categories).toEqual([]);
                    },
                );

                it(
                    'should throw McpError for non-existent store (STORE_NOT_FOUND)', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/nonexistent'), {
                                    name: 'nonexistent',
                                },
                            );
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            expect((error as McpError).message).toContain("Store 'nonexistent' not found");
                        }
                    },
                );

                it(
                    'should throw McpError for invalid store name format - starting with hyphen', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/-invalid'), {
                                    name: '-invalid',
                                },
                            );
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            expect((error as McpError).message).toContain('Store name must start with alphanumeric');
                        }
                    },
                );

                it(
                    'should throw McpError for invalid store name format - empty name', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/'), {
                                    name: '',
                                },
                            );
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            // Empty string is falsy, so it's treated as missing name
                            expect((error as McpError).message).toContain('Store name is required');
                        }
                    },
                );

                it(
                    'should throw McpError for invalid store name format - special characters', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        await expect(async () => {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/store@name'), {
                                    name: 'store@name',
                                },
                            ); 
                        }).toThrow(McpError);
                    },
                );

                it(
                    'should throw McpError when store name is missing from variables', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/'),
                                {}, // No name variable
                            );
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            expect((error as McpError).message).toContain('Store name is required');
                        }
                    },
                );

                it(
                    'should handle array variable with single element', async () => {
                        // Create store
                        await fs.mkdir(path.join(
                            testDir, 'array-test-store',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/array-test-store'),
                            { name: ['array-test-store'] }, // Array with single element
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed).toHaveProperty(
                            'name', 'array-test-store',
                        );
                        expect(parsed).toHaveProperty('categories');
                    },
                );

                it(
                    'should throw McpError for array variable with multiple elements', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/'), {
                                    name: [
                                        'store1',
                                        'store2', 
                                    ],
                                },
                            ); // Array with multiple elements
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            expect((error as McpError).message).toContain('Store name is required');
                        }
                    },
                );

                it(
                    'should include correct URI in response', async () => {
                        await fs.mkdir(path.join(
                            testDir, 'uri-test',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const testUrl = new URL('cortex://store/uri-test');
                        const result = await storeDetailResource!.readCallback(
                            testUrl, { name: 'uri-test' },
                        );

                        expect(result.contents[0]?.uri).toBe('cortex://store/uri-test');
                    },
                );
            },
        );

        describe(
            'Resource Template List Callback', () => {
                it(
                    'should return all stores as discoverable resources', async () => {
                        // Create some stores
                        await fs.mkdir(path.join(
                            testDir, 'store-alpha',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'store-beta',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'store-gamma',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        expect(storeDetailResource).toBeDefined();
                        expect(storeDetailResource?.resourceTemplate?._callbacks?.list).toBeDefined();

                        const listResult = await storeDetailResource!.resourceTemplate._callbacks.list!();

                        expect(listResult).toHaveProperty('resources');
                        expect(listResult.resources).toHaveLength(3);

                        // Verify each resource has correct structure
                        const storeAlpha = listResult.resources.find((r) => r.uri === 'cortex://store/store-alpha');
                        expect(storeAlpha).toBeDefined();
                        expect(storeAlpha?.name).toBe('Store: store-alpha');
                        expect(storeAlpha?.mimeType).toBe('application/json');

                        const storeBeta = listResult.resources.find((r) => r.uri === 'cortex://store/store-beta');
                        expect(storeBeta).toBeDefined();
                        expect(storeBeta?.name).toBe('Store: store-beta');

                        const storeGamma = listResult.resources.find((r) => r.uri === 'cortex://store/store-gamma');
                        expect(storeGamma).toBeDefined();
                        expect(storeGamma?.name).toBe('Store: store-gamma');
                    },
                );

                it(
                    'should return empty resources array when no stores exist', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const listResult = await storeDetailResource!.resourceTemplate._callbacks.list!();

                        expect(listResult).toHaveProperty('resources');
                        expect(listResult.resources).toEqual([]);
                    },
                );

                it(
                    'should throw McpError when listStores fails', async () => {
                        // Create a file instead of a directory to cause listStores to fail
                        const filePath = path.join(
                            testDir, 'not-a-directory',
                        );
                        await fs.writeFile(
                            filePath, 'content',
                        );

                        const invalidConfig: ServerConfig = {
                            ...config,
                            dataPath: filePath,
                        };

                        registerStoreResources(
                            server, invalidConfig,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        expect(storeDetailResource).toBeDefined();
                        expect(storeDetailResource?.resourceTemplate?._callbacks?.list).toBeDefined();

                        // When listStores fails in list callback, it should throw McpError
                        await expect(async () => {
                            await storeDetailResource!.resourceTemplate._callbacks.list!(); 
                        }).toThrow(McpError);
                    },
                );

                it(
                    'should only include directories in resource list', async () => {
                        // Create mix of files and directories
                        await fs.mkdir(path.join(
                            testDir, 'real-store-1',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'real-store-2',
                        ));
                        await fs.writeFile(
                            path.join(
                                testDir, 'not-a-store.txt',
                            ), 'content',
                        );

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const listResult = await storeDetailResource!.resourceTemplate._callbacks.list!();

                        expect(listResult.resources).toHaveLength(2);
                        const uris = listResult.resources.map((r) => r.uri);
                        expect(uris).toContain('cortex://store/real-store-1');
                        expect(uris).toContain('cortex://store/real-store-2');
                        expect(uris).not.toContain('cortex://store/not-a-store.txt');
                    },
                );
            },
        );

        describe(
            'Resource Template Complete Callback', () => {
                it(
                    'should return all store names for autocomplete', async () => {
                        // Create some stores
                        await fs.mkdir(path.join(
                            testDir, 'store-alpha',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'store-beta',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        expect(storeDetailResource?.resourceTemplate?._callbacks?.complete?.name).toBeDefined();

                        const completions =
                            await storeDetailResource!.resourceTemplate._callbacks.complete!.name!();

                        expect(completions).toHaveLength(2);
                        expect(completions).toContain('store-alpha');
                        expect(completions).toContain('store-beta');
                    },
                );

                it(
                    'should return empty array for autocomplete when no stores exist', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const completions =
                            await storeDetailResource!.resourceTemplate._callbacks.complete!.name!();

                        expect(completions).toEqual([]);
                    },
                );

                it(
                    'should return empty array for autocomplete when listStores fails', async () => {
                        const filePath = path.join(
                            testDir, 'not-a-directory',
                        );
                        await fs.writeFile(
                            filePath, 'content',
                        );

                        const invalidConfig: ServerConfig = {
                            ...config,
                            dataPath: filePath,
                        };

                        registerStoreResources(
                            server, invalidConfig,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        // Complete handler should return empty array on error (not throw)
                        const completions =
                            await storeDetailResource!.resourceTemplate._callbacks.complete!.name!();

                        expect(completions).toEqual([]);
                    },
                );
            },
        );

        describe(
            'getStoreCategories (tested via store-detail resource)', () => {
                it(
                    'should successfully list subdirectories', async () => {
                        await fs.mkdir(path.join(
                            testDir, 'test-store',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'test-store', 'subdir-1',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'test-store', 'subdir-2',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'test-store', 'subdir-3',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/test-store'),
                            { name: 'test-store' },
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.categories).toHaveLength(3);
                        expect(parsed.categories).toContain('subdir-1');
                        expect(parsed.categories).toContain('subdir-2');
                        expect(parsed.categories).toContain('subdir-3');
                    },
                );

                it(
                    'should throw McpError with STORE_NOT_FOUND for non-existent store', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        try {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/does-not-exist'), {
                                    name: 'does-not-exist',
                                },
                            );
                            expect(true).toBe(false); // Should not reach here
                        }
                        catch (error) {
                            expect(error).toBeInstanceOf(McpError);
                            expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
                            expect((error as McpError).message).toContain("Store 'does-not-exist' not found");
                        }
                    },
                );

                it(
                    'should filter out files and only return directories', async () => {
                        await fs.mkdir(path.join(
                            testDir, 'mixed-store',
                        ));
                        await fs.mkdir(path.join(
                            testDir, 'mixed-store', 'actual-category',
                        ));
                        await fs.writeFile(
                            path.join(
                                testDir, 'mixed-store', 'some-file.txt',
                            ), 'content',
                        );
                        await fs.writeFile(
                            path.join(
                                testDir, 'mixed-store', 'another-file.md',
                            ), 'content',
                        );

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/mixed-store'),
                            { name: 'mixed-store' },
                        );

                        const parsed = JSON.parse(result.contents[0]!.text);
                        expect(parsed.categories).toEqual(['actual-category']);
                    },
                );
            },
        );

        describe(
            'Result type structure', () => {
                it(
                    'should return proper content structure for successful store list', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        const result = await storeListResource!.readCallback(
                            new URL('cortex://store/'), {},
                        );

                        expect(result).toHaveProperty('contents');
                        expect(Array.isArray(result.contents)).toBe(true);
                        expect(result.contents[0]).toHaveProperty('uri');
                        expect(result.contents[0]).toHaveProperty('mimeType');
                        expect(result.contents[0]).toHaveProperty('text');
                    },
                );

                it(
                    'should return proper content structure for successful store detail', async () => {
                        await fs.mkdir(path.join(
                            testDir, 'structure-test',
                        ));

                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        const result = await storeDetailResource!.readCallback(
                            new URL('cortex://store/structure-test'),
                            { name: 'structure-test' },
                        );

                        expect(result).toHaveProperty('contents');
                        expect(Array.isArray(result.contents)).toBe(true);
                        expect(result.contents[0]).toHaveProperty('uri');
                        expect(result.contents[0]).toHaveProperty('mimeType');
                        expect(result.contents[0]).toHaveProperty('text');
                    },
                );

                it(
                    'should throw McpError for store list failure', async () => {
                        const filePath = path.join(
                            testDir, 'not-a-directory',
                        );
                        await fs.writeFile(
                            filePath, 'content',
                        );

                        const invalidConfig: ServerConfig = {
                            ...config,
                            dataPath: filePath,
                        };

                        registerStoreResources(
                            server, invalidConfig,
                        );

                        const registeredResources = getRegisteredResources(server);
                        const storeListResource = registeredResources['cortex://store/'];

                        await expect(async () => {
                            await storeListResource!.readCallback(
                                new URL('cortex://store/'), {},
                            ); 
                        }).toThrow(McpError);
                    },
                );

                it(
                    'should throw McpError for store detail failure', async () => {
                        registerStoreResources(
                            server, config,
                        );

                        const registeredTemplates = getRegisteredResourceTemplates(server);
                        const storeDetailResource = registeredTemplates['store-detail'];

                        await expect(async () => {
                            await storeDetailResource!.readCallback(
                                new URL('cortex://store/nonexistent'), {
                                    name: 'nonexistent',
                                },
                            ); 
                        }).toThrow(McpError);
                    },
                );
            },
        );
    },
);
