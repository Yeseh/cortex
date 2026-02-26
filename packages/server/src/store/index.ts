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
 * registerStoreTools(ctx.server, ctx);
 * ```
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CortexContext } from '@yeseh/cortex-core';
import { listStoresHandler, createStoreHandler, storeNameSchema } from './tools.ts';
import { wrapToolHandler } from '../response.ts';

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
 * @param ctx - Tool context containing config and cortex instance
 *
 * @example
 * ```ts
 * const server = createMcpServer();
 * const ctx: CortexContext = { config, cortex };
 * registerStoreTools(server, ctx);
 * ```
 */
export const registerStoreTools = (server: McpServer, ctx: CortexContext): void => {
    // Register cortex_list_stores tool
    server.registerTool(
        'cortex_list_stores',
        {
            description: 'List all available memory stores',
        },
        wrapToolHandler(async () => listStoresHandler(ctx))
    );

    // Register cortex_create_store tool with input schema
    server.registerTool(
        'cortex_create_store',
        {
            description: 'Create a new memory store',
            inputSchema: {
                name: storeNameSchema.describe(
                    'Name of the store to create (alphanumeric, hyphens, underscores only)'
                ),
            },
        },
        wrapToolHandler(async ({ name }) => createStoreHandler(ctx, { name: name as string }))
    );
};

// Re-export tools for direct usage
export { listStores, storeNameSchema, createStoreInputSchema } from './tools.ts';
export type {
    StoreToolError,
    StoreToolErrorCode,
    CreateStoreInput,
    StoreInfo,
    ListStoresResult,
} from './tools.ts';

// Re-export shared utilities
export { convertToCategories } from './shared.ts';
export type { CategoryInfo } from './shared.ts';
