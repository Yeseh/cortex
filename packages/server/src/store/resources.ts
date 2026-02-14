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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { ServerConfig } from '../config.ts';
import { ok, type Result } from '@yeseh/cortex-core';
import { listStores, storeNameSchema } from './tools.ts';
import { err } from '../../../storage-fs/src/utils.ts';

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
 * Gets the root-level categories (subdirectories) of a store.
 *
 * @param dataPath - Directory where stores are persisted
 * @param storeName - Name of the store to read
 * @returns Result with list of category names or error
 */
export const getStoreCategories = async (
    dataPath: string,
    storeName: string,
): Promise<Result<string[], StoreResourceError>> => {
    const storePath = path.join(
        dataPath, storeName,
    );
    try {
        const entries = await fs.readdir(
            storePath, { withFileTypes: true },
        );
        const categories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
        return ok(categories); 
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${storeName}' not found`,
            }); 
        }
        return err({
            code: 'STORE_READ_FAILED',
            message: `Failed to read store: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        });
    }
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
 *
 * @example
 * ```ts
 * const server = createMcpServer();
 * const config = { dataPath: './.cortex-data', ... };
 * registerStoreResources(server, config);
 * ```
 */
export const registerStoreResources = (
    server: McpServer, config: ServerConfig,
): void => {
    // Register cortex://store/ resource for listing all stores
    server.registerResource(
        'store-list',
        'cortex://store/',
        { description: 'List all available memory stores', mimeType: 'application/json' },
        async (): Promise<ReadResourceResult> => {
            const result = await listStores(config.dataPath);
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                throw new McpError(
                    ErrorCode.InternalError, result.error.message,
                ); 
            }
            return {
                contents: [{
                    uri: 'cortex://store/',
                    mimeType: 'application/json',
                    text: JSON.stringify({ stores: result.value }),
                }],
            };
        },
    );

    // Register cortex://store/{name} resource template for store details
    const storeDetailTemplate = new ResourceTemplate(
        'cortex://store/{name}', {
            list: async () => {
            // List all stores as resources for discovery
                const result = await listStores(config.dataPath);
                // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
                if (!result.ok()) {
                    throw new McpError(
                        ErrorCode.InternalError, result.error.message,
                    ); 
                }
                return {
                    resources: result.value.map((name) => ({
                        uri: `cortex://store/${name}`,
                        name: `Store: ${name}`,
                        mimeType: 'application/json',
                    })),
                };
            },
            complete: {
                name: async (): Promise<string[]> => {
                    const result = await listStores(config.dataPath);
                    if (!result.ok()) return [];
                    return result.value;
                },
            },
        },
    );

    server.registerResource(
        'store-detail',
        storeDetailTemplate,
        {
            description: 'Get store metadata and root category listing',
            mimeType: 'application/json',
        },
        async (
            uri: URL, variables: Variables,
        ): Promise<ReadResourceResult> => {
            const storeName = getStringVariable(variables.name);

            // Validate store name is present and valid format
            // MCP SDK callbacks require thrown errors - convert validation failures to exceptions
            if (!storeName) {
                throw new McpError(
                    ErrorCode.InvalidParams, 'Store name is required',
                ); 
            }

            const nameValidation = storeNameSchema.safeParse(storeName);
            if (!nameValidation.success) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    nameValidation.error.issues.map((i) => i.message).join('; '),
                ); 
            }

            // Get store categories
            const result = await getStoreCategories(
                config.dataPath, storeName,
            );
            // MCP SDK callbacks require thrown errors - convert Result to exception at SDK boundary
            if (!result.ok()) {
                const errorCode =
                    result.error.code === 'STORE_NOT_FOUND'
                        ? ErrorCode.InvalidParams
                        : ErrorCode.InternalError;
                throw new McpError(
                    errorCode, result.error.message,
                );
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
