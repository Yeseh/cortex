/**
 * Express server setup and entry point for the Cortex MCP server.
 *
 * This module provides the main server factory function and handles
 * the complete lifecycle of the Cortex MCP server including:
 * - Configuration loading from environment variables
 * - Express app setup with JSON body parsing
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
 * if (result.ok) {
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

import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { loadServerConfig, type ServerConfig } from './config.ts';
import { createMcpContext, type McpContext } from './mcp.ts';
import { createHealthRouter } from './health.ts';
import { registerMemoryTools } from './memory/index.ts';
import { registerStoreTools } from './store/index.ts';
import { registerCategoryTools } from './category/index.ts';
import type { Result } from '@yeseh/cortex-core';

/**
 * Complete Cortex server instance with all components.
 *
 * This interface provides access to all server components for
 * advanced use cases like testing, monitoring, or extension.
 */
export interface CortexServer {
    /** Express application instance for adding middleware or routes */
    app: Express;

    /** Underlying Node.js HTTP server for low-level access */
    httpServer: Server;

    /** MCP context containing server and transport */
    mcpContext: McpContext;

    /** Resolved server configuration */
    config: ServerConfig;

    /**
     * Gracefully shuts down the server.
     *
     * Closes the MCP server connection first, then the HTTP server.
     * Waits for all connections to close before resolving.
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
 * 2. Creates Express app with JSON body parsing (1MB limit)
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
 * if (!result.ok) {
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
 * if (result.ok) {
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
 * if (result.ok) {
 *   const { app, mcpContext } = result.value;
 *
 *   // Add test middleware
 *   app.use('/test', testRouter);
 *
 *   // Access MCP server for tool inspection
 *   const tools = mcpContext.server.listTools();
 * }
 * ```
 */
export const createServer = async (): Promise<Result<CortexServer, ServerStartError>> => {
    // Load config
    const configResult = loadServerConfig();
    if (!configResult.ok) {
        return {
            ok: false,
            error: {
                code: 'CONFIG_INVALID',
                message: `Configuration error: ${configResult.error.message}`,
                cause: new Error(configResult.error.message),
            },
        };
    }
    const config = configResult.value;

    // Create Express app
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    // Create MCP context
    const mcpContext = createMcpContext();
    const { server, transport } = mcpContext;

    // Register MCP tools
    registerMemoryTools(server, config);
    registerStoreTools(server, config);
    registerCategoryTools(server, config);

    // Connect MCP server to transport
    await server.connect(transport);

    // Mount MCP endpoint
    app.post('/mcp', async (req, res) => {
        try {
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
            console.error('MCP request handling error:', error);
        }
    });

    // Mount health endpoint
    app.use('/health', createHealthRouter(config));

    // Start HTTP server
    const httpServer = app.listen(config.port, config.host, () => {
        console.warn(`Cortex MCP server listening on http://${config.host}:${config.port}`);
        console.warn(`  Data path: ${config.dataPath}`);
        console.warn(`  Default store: ${config.defaultStore}`);
        console.warn('  MCP endpoint: POST /mcp');
        console.warn('  Health check: GET /health');
    });

    // Graceful shutdown handler
    const close = async (): Promise<void> => {
        await server.close();
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    };

    return { ok: true, value: { app, httpServer, mcpContext, config, close } };
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
            if (!result.ok) {
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
