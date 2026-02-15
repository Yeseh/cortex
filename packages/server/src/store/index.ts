/**
 * Store management MCP tool and resource registration.
 *
 * This module registers MCP tools and resources for managing memory stores:
 *
 * Tools:
 * - `cortex_list_stores` - List all available memory stores
 * - `cortex_create_store` - Create a new memory store
 *
 * Resources:
 * - `cortex://store/` - List all available stores
 * - `cortex://store/{name}` - Get store metadata and root categories
 *
 * @module server/store
 *
 * @example
 * ```ts
 * import { registerStoreTools } from './store/index.ts';
 *
 * const ctx = createMcpContext();
 * registerStoreTools(ctx.server, config);
 * ```
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as path from 'node:path';
import { initializeStore } from '@yeseh/cortex-core/store';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import type { ServerConfig } from '../config.ts';
import { listStoresFromRegistry, storeNameSchema } from './tools.ts';
import { registerStoreResources } from './resources.ts';

/**
 * Registers store management tools with the MCP server.
 *
 * Registers the following tools:
 * - `cortex_list_stores` - Lists all available memory stores in the data directory
 * - `cortex_create_store` - Creates a new memory store with the given name
 *
 * Also registers store resources:
 * - `cortex://store/` - Lists all available stores
 * - `cortex://store/{name}` - Gets store metadata and root category listing
 *
 * @param server - MCP server instance for tool registration
 * @param config - Server configuration containing data path
 *
 * @example
 * ```ts
 * const server = createMcpServer();
 * const config = { dataPath: './.cortex-data', ... };
 * registerStoreTools(server, config);
 * ```
 */
export const registerStoreTools = (server: McpServer, config: ServerConfig): void => {
    // Register cortex_list_stores tool
    server.registerTool(
        'cortex_list_stores',
        {
            description: 'List all available memory stores',
        },
        async () => {
            const registryPath = path.join(config.dataPath, 'stores.yaml');
            const result = await listStoresFromRegistry(registryPath);
            if (!result.ok()) {
                return {
                    content: [{ type: 'text', text: `Error: ${result.error.message}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }],
            };
        },
    );

    // Register cortex_create_store tool with input schema
    server.registerTool(
        'cortex_create_store',
        {
            description: 'Create a new memory store',
            inputSchema: {
                name: storeNameSchema.describe(
                    'Name of the store to create (alphanumeric, hyphens, underscores only)',
                ),
            },
        },
        async ({ name }) => {
            const registryPath = path.join(config.dataPath, 'stores.yaml');
            const registry = new FilesystemRegistry(registryPath);
            const storePath = path.join(config.dataPath, name);

            // Delegate to core's initializeStore which handles:
            // 1. Creating the store directory
            // 2. Registering the store in stores.yaml
            // 3. Creating the root category index
            const result = await initializeStore(registry, name, storePath);
            if (!result.ok()) {
                return {
                    content: [{ type: 'text', text: `Error: ${result.error.message}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: 'text', text: JSON.stringify({ created: name }, null, 2) }],
            };
        },
    );

    // Register store resources
    registerStoreResources(server, config);
};

// Re-export tools for direct usage
export { listStores, listStoresFromRegistry, storeNameSchema, createStoreInputSchema } from './tools.ts';
export type { StoreToolError, StoreToolErrorCode, CreateStoreInput, StoreInfo, ListStoresResult } from './tools.ts';

// Re-export resources
export { registerStoreResources } from './resources.ts';
export type { StoreResourceError, StoreResourceErrorCode } from './resources.ts';
