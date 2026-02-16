/**
 * Store MCP resource implementations.
 *
 * This module provides read-only MCP resources for accessing store
 * metadata and listings via URI-based addressing:
 * - `cortex://store/` - List all available stores
 * - `cortex://store/{name}` - Get store metadata and root categories
 *
 * @module server/store/resources
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { ServerConfig } from '../config.ts';
import type { Cortex } from '@yeseh/cortex-core';
import { CategoryPath, err, ok, type Result } from '@yeseh/cortex-core';
import { listStoresFromCortex, storeNameSchema } from './tools.ts';

/**
 * Extracts a single string value from a Variables entry.
 * Returns undefined if the value is an array or undefined.
 */
const getStringVariable = (value: string | string[] | undefined): string | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length === 1) return value[0];
    return undefined;
};

/**
 * Error codes for store resource operations.
 *
 * - `STORE_NOT_FOUND` - Store does not exist
 * - `STORE_READ_FAILED` - Could not read store directory
 */
export type StoreResourceErrorCode = 'STORE_NOT_FOUND' | 'STORE_READ_FAILED';

/**
 * Error details for store resource failures.
 */
export interface StoreResourceError {
    /** Error classification code */
    code: StoreResourceErrorCode;
    /** Human-readable error description */
    message: string;
    /** Original error that caused the failure */
    cause?: unknown;
}

/**
 * Gets the root-level categories (subcategories) of a store.
 *
 * Uses the Cortex client to get the store adapter and read the root index.
 *
 * @param cortex - Cortex client instance
 * @param storeName - Name of the store to read
 * @returns Result with list of category names or error
 */
export const getStoreCategories = async (
    cortex: Cortex,
    storeName: string,
): Promise<Result<string[], StoreResourceError>> => {
    const storeResult = cortex.getStore(storeName);
    if (!storeResult.ok()) {
        return err({
            code: 'STORE_NOT_FOUND',
            message: `Store '${storeName}' not found`,
        });
    }

    const adapter = storeResult.value;
    const rootIndexResult = await adapter.indexes.read(CategoryPath.root());
    if (!rootIndexResult.ok()) {
        return err({
            code: 'STORE_READ_FAILED',
            message: `Failed to read store root index: ${rootIndexResult.error.message}`,
            cause: rootIndexResult.error,
        });
    }

    // Return subcategory names from root index
    const categories = rootIndexResult.value?.subcategories.map((sub) => sub.path.toString()) ?? [];
    return ok(categories);
};

/**
 * Registers store resources with the MCP server.
 *
 * Registers the following resources:
 * - `cortex://store/` - Lists all available memory stores
 * - `cortex://store/{name}` - Gets store metadata and root category listing
 *
 * @param server - MCP server instance for resource registration
 * @param config - Server configuration containing data path
 * @param cortex - Cortex client instance for store access
 *
 * @example
 * ```ts
 * const server = createMcpServer();
 * const config = { dataPath: './.cortex-data', ... };
 * registerStoreResources(server, config, cortex);
 * ```
 */
export const registerStoreResources = (
    server: McpServer,
    _config: ServerConfig,
    cortex: Cortex,
): void => {
    // Register cortex://store/ resource for listing all stores
    server.registerResource(
        'store-list',
        'cortex://store/',
        { description: 'List all available memory stores', mimeType: 'application/json' },
        async (): Promise<ReadResourceResult> => {
            const result = listStoresFromCortex(cortex);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                throw new McpError(ErrorCode.InternalError, result.error.message);
            }
            return {
                contents: [{
                    uri: 'cortex://store/',
                    mimeType: 'application/json',
                    text: JSON.stringify({ stores: result.value.stores.map((s) => s.name) }),
                }],
            };
        },
    );

    // Register cortex://store/{name} resource template for store details
    const storeDetailTemplate = new ResourceTemplate('cortex://store/{name}', {
        list: async () => {
            // List all stores as resources for discovery
            const result = listStoresFromCortex(cortex);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                throw new McpError(ErrorCode.InternalError, result.error.message);
            }
            return {
                resources: result.value.stores.map((store) => ({
                    uri: `cortex://store/${store.name}`,
                    name: `Store: ${store.name}`,
                    mimeType: 'application/json',
                })),
            };
        },
        complete: {
            name: (): string[] => {
                const result = listStoresFromCortex(cortex);
                if (!result.ok()) return [];
                return result.value.stores.map((s) => s.name);
            },
        },
    });

    server.registerResource(
        'store-detail',
        storeDetailTemplate,
        {
            description: 'Get store metadata and root category listing',
            mimeType: 'application/json',
        },
        async (uri: URL, variables: Variables): Promise<ReadResourceResult> => {
            const storeName = getStringVariable(variables.name);

            // Validate store name is present and valid format
            // MCP SDK callbacks require thrown errors - convert validation failures to exceptions
            if (!storeName) {
                throw new McpError(ErrorCode.InvalidParams, 'Store name is required');
            }

            const nameValidation = storeNameSchema.safeParse(storeName);
            if (!nameValidation.success) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    nameValidation.error.issues.map((i) => i.message).join('; '),
                );
            }

            // Get store categories
            const result = await getStoreCategories(cortex, storeName);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                const errorCode =
                    result.error.code === 'STORE_NOT_FOUND'
                        ? ErrorCode.InvalidParams
                        : ErrorCode.InternalError;
                throw new McpError(errorCode, result.error.message);
            }
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        name: storeName,
                        categories: result.value,
                    }),
                }],
            };
        },
    );
};
