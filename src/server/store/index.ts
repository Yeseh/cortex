/**
 * Store management MCP tool registration.
 *
 * This module registers MCP tools for managing memory stores:
 * - `list_stores` - List all available memory stores
 * - `create_store` - Create a new memory store
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
import type { ServerConfig } from '../config.ts';
import { listStores, createStore, storeNameSchema } from './tools.ts';

/**
 * Registers store management tools with the MCP server.
 *
 * Registers the following tools:
 * - `list_stores` - Lists all available memory stores in the data directory
 * - `create_store` - Creates a new memory store with the given name
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
    // Register list_stores tool
    server.registerTool(
        'list_stores',
        {
            description: 'List all available memory stores',
        },
        async () => {
            const result = await listStores(config.dataPath);
            if (!result.ok) {
                return {
                    content: [{ type: 'text', text: `Error: ${result.error.message}` }],
                    isError: true,
                };
            }
            return {
                content: [
                    { type: 'text', text: JSON.stringify({ stores: result.value }, null, 2) },
                ],
            };
        }
    );

    // Register create_store tool with input schema
    server.registerTool(
        'create_store',
        {
            description: 'Create a new memory store',
            inputSchema: {
                name: storeNameSchema.describe(
                    'Name of the store to create (alphanumeric, hyphens, underscores only)'
                ),
            },
        },
        async ({ name }) => {
            const result = await createStore(config.dataPath, name);
            if (!result.ok) {
                return {
                    content: [{ type: 'text', text: `Error: ${result.error.message}` }],
                    isError: true,
                };
            }
            return {
                content: [{ type: 'text', text: JSON.stringify({ created: name }, null, 2) }],
            };
        }
    );
};

// Re-export tools for direct usage
export { listStores, createStore, storeNameSchema, createStoreInputSchema } from './tools.ts';
export type { StoreToolError, StoreToolErrorCode, CreateStoreInput } from './tools.ts';
