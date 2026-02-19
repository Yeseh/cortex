/**
 * Bun HTTP server setup and entry point for the Cortex MCP server.
 *
 * This module provides the main server factory function and handles
 * the complete lifecycle of the Cortex MCP server including:
 * - Configuration loading from environment variables
 * - Bun HTTP server setup with routes
 * - MCP protocol endpoint at POST /mcp
 * - Health check endpoint at GET /health
 * - Graceful shutdown handling
 *
 * @module server/index
 *
 * @example
 * ```ts
 * // Programmatic server creation
 * const result = await createServer();
 * if (result.ok()) {
 *   const { config, close } = result.value;
 *   console.log(`Server running on port ${config.port}`);
 *
 *   // Graceful shutdown
 *   process.on('SIGTERM', async () => {
 *     await close();
 *     process.exit(0);
 *   });
 * }
 * ```
 */

import { loadServerConfig, type ServerConfig } from './config.ts';
import { createMcpContext, type McpContext } from './mcp.ts';
import { createHealthResponse } from './health.ts';
import { registerMemoryTools } from './memory/index.ts';
import { registerStoreTools } from './store/index.ts';
import { registerCategoryTools, type CategoryToolsOptions } from './category/index.ts';
import { err, ok, type Result, Cortex } from '@yeseh/cortex-core';
import type { ScopedStorageAdapter } from '@yeseh/cortex-core/storage';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { ToolContext } from './memory/tools/shared.ts';

/**
 * Complete Cortex server instance with all components.
 *
 * This interface provides access to all server components for
 * advanced use cases like testing, monitoring, or extension.
 */
export interface CortexServer {
    /** Bun HTTP server instance for low-level access */
    server: ReturnType<typeof Bun.serve>;

    /** MCP context containing server and transport */
    mcpContext: McpContext;

    /** Resolved server configuration */
    config: ServerConfig;

    /**
     * Gracefully shuts down the server.
     *
     * Closes the MCP server connection first, then stops the HTTP server.
     */
    close: () => Promise<void>;
}

/** Error codes for server startup failures */
export type ServerStartErrorCode = 'CONFIG_INVALID' | 'SERVER_START_FAILED';

/**
 * Error details for server startup failures.
 *
 * Contains information about why the server failed to start,
 * including the original cause when available.
 */
export interface ServerStartError {
    /**
     * Error classification code:
     * - `CONFIG_INVALID` - Environment configuration failed validation
     * - `SERVER_START_FAILED` - Server initialization or binding failed
     */
    code: ServerStartErrorCode;

    /** Human-readable error description */
    message: string;

    /** Original error that caused the failure (when available) */
    cause?: Error;
}

/**
 * Creates and starts the Cortex MCP server.
 *
 * This is the main entry point for starting the server programmatically.
 * It performs the following steps:
 * 1. Loads configuration from environment variables
 * 2. Creates Bun HTTP server with routes
 * 3. Sets up MCP server and connects transport
 * 4. Mounts MCP endpoint at POST /mcp
 * 5. Mounts health endpoint at GET /health
 * 6. Starts HTTP server on configured host:port
 *
 * @returns Promise resolving to Result with server instance or error
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await createServer();
 * if (!result.ok()) {
 *   console.error('Failed to start:', result.error.message);
 *   process.exit(1);
 * }
 *
 * const server = result.value;
 * console.log(`Listening on ${server.config.host}:${server.config.port}`);
 * ```
 *
 * @example
 * ```ts
 * // With graceful shutdown
 * const result = await createServer();
 * if (result.ok()) {
 *   const server = result.value;
 *
 *   process.on('SIGTERM', async () => {
 *     console.log('Shutting down...');
 *     await server.close();
 *     process.exit(0);
 *   });
 * }
 * ```
 *
 * @example
 * ```ts
 * // For testing - access internal components
 * const result = await createServer();
 * if (result.ok()) {
 *   const { server, mcpContext } = result.value;
 *
 *   // Access server port
 *   console.log(`Running on port ${server.port}`);
 *
 *   // Access MCP server for tool inspection
 *   const tools = mcpContext.server.listTools();
 * }
 * ```
 */
export const createServer = async (): Promise<Result<CortexServer, ServerStartError>> => {
    // Load config
    const configResult = loadServerConfig();
    if (!configResult.ok()) {
        return err({
            code: 'CONFIG_INVALID',
            message: `Configuration error: ${configResult.error.message}`,
            cause: new Error(configResult.error.message),
        });
    }
    const config = configResult.value;

    // Create adapter factory for Cortex
    const createAdapterFactory = () => {
        return (storePath: string): ScopedStorageAdapter => {
            const adapter = new FilesystemStorageAdapter({ rootDirectory: storePath });
            return {
                memories: adapter.memories,
                indexes: adapter.indexes,
                categories: adapter.categories,
            };
        };
    };

    // Load Cortex from config
    const cortexResult = await Cortex.fromConfig(config.dataPath);
    let cortex: Cortex;
    if (cortexResult.ok()) {
        cortex = cortexResult.value;
    }
    else {
        // Fall back to minimal init if no config exists
        cortex = Cortex.init({
            rootDirectory: config.dataPath,
            adapterFactory: createAdapterFactory(),
        });
    }

    // Create tool context with Cortex
    const toolContext: ToolContext = { config, cortex };

    // Create MCP context
    const mcpContext = createMcpContext();
    const { server: mcpServer, transport } = mcpContext;

    // Get category mode options from default store config
    const registry = cortex.getRegistry();
    const defaultStoreConfig = registry[config.defaultStore];
    const categoryToolsOptions: CategoryToolsOptions = {
        mode: defaultStoreConfig?.categoryMode ?? 'free',
        configCategories: defaultStoreConfig?.categories,
    };

    // Register MCP tools
    registerMemoryTools(mcpServer, toolContext);
    registerStoreTools(mcpServer, toolContext);
    registerCategoryTools(mcpServer, toolContext, categoryToolsOptions);

    // Connect MCP server to transport
    await mcpServer.connect(transport);

    // Create Bun HTTP server with routes
    const server = Bun.serve({
        port: config.port,
        hostname: config.host,
        routes: {
            '/mcp': {
                POST: async (req) => {
                    try {
                        // Enforce 1MB body size limit (matching previous Express config)
                        const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
                        if (contentLength > 1024 * 1024) {
                            return Response.json(
                                { error: 'Request body too large. Maximum size is 1MB.' },
                                { status: 413 },
                            );
                        }

                        return await transport.handleRequest(req);
                    }
                    catch (error) {
                        console.error('MCP request handling error:', error);
                        return Response.json({ error: 'Internal server error' }, { status: 500 });
                    }
                },
            },
            '/health': {
                GET: async () => createHealthResponse({ config, cortex }),
            },
        },
        fetch: () => new Response('Not Found', { status: 404 }),
    });

    console.warn(`Cortex MCP server listening on http://${config.host}:${config.port}`);
    console.warn(`  Data path: ${config.dataPath}`);
    console.warn(`  Default store: ${config.defaultStore}`);
    console.warn('  MCP endpoint: POST /mcp');
    console.warn('  Health check: GET /health');

    // Graceful shutdown handler
    const close = async (): Promise<void> => {
        await mcpServer.close();
        server.stop();
    };

    return ok({ server, mcpContext, config, close });
};

// Start server if this is the main module
if (import.meta.main) {
    const shutdown = async (server: CortexServer): Promise<void> => {
        console.warn('Shutting down...');
        await server.close();
        process.exit(0);
    };

    createServer()
        .then((result) => {
            if (!result.ok()) {
                console.error('Failed to start server:', result.error.message);
                process.exit(1);
            }
            const server = result.value;
            process.on('SIGTERM', () => shutdown(server));
            process.on('SIGINT', () => shutdown(server));
        })
        .catch((error) => {
            console.error('Failed to start server:', error);
            process.exit(1);
        });
}
