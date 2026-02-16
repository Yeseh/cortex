/**
 * MCP server instance and Web Standard Streamable HTTP transport setup.
 *
 * This module provides factory functions for creating the MCP server
 * and transport layer used by the Cortex memory system. It configures
 * the server with the appropriate name and version, and sets up
 * stateless Web Standard HTTP transport for containerized deployments.
 *
 * @module server/mcp
 *
 * @example
 * ```ts
 * // Create complete MCP context for server setup
 * const ctx = createMcpContext();
 * await ctx.server.connect(ctx.transport);
 *
 * // Handle incoming MCP requests (returns a Response object)
 * app.post('/mcp', async (req) => {
 *   return ctx.transport.handleRequest(req);
 * });
 * ```
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { SERVER_NAME, SERVER_VERSION } from './config.ts';

/**
 * Context object containing MCP server and transport instances.
 *
 * Use this interface when passing around the complete MCP setup.
 * The server handles tool registration and execution, while the
 * transport handles HTTP request/response communication.
 */
export interface McpContext {
    /** MCP server instance for tool registration and execution */
    server: McpServer;
    /** HTTP transport for handling MCP protocol messages */
    transport: WebStandardStreamableHTTPServerTransport;
}

/**
 * Creates a new MCP server instance configured for Cortex memory operations.
 *
 * The server is created with the standard Cortex server name and version,
 * which are reported to MCP clients during protocol negotiation.
 *
 * @returns Configured MCP server instance ready for tool registration
 *
 * @example
 * ```ts
 * const server = createMcpServer();
 * server.tool('memory_store', schema, handler);
 * ```
 */
export const createMcpServer = (): McpServer => {
    return new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    });
};

/**
 * Creates a Web Standard Streamable HTTP transport for stateless MCP communication.
 *
 * The transport is configured in stateless mode (no session ID generation),
 * which is appropriate for containerized deployments where requests may
 * be routed to different instances.
 *
 * @returns Configured HTTP transport ready for request handling
 *
 * @example
 * ```ts
 * const transport = createMcpTransport();
 * await server.connect(transport);
 *
 * // In Bun/Web Standard route handler (returns Response)
 * const response = await transport.handleRequest(req);
 * ```
 */
export const createMcpTransport = (): WebStandardStreamableHTTPServerTransport => {
    return new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
    });
};

/**
 * Creates a complete MCP context with server and transport.
 *
 * This is the primary factory function for setting up MCP communication.
 * It creates both the server and transport, returning them as a single
 * context object for convenient passing through the application.
 *
 * @returns Context containing connected server and transport
 *
 * @example
 * ```ts
 * const ctx = createMcpContext();
 *
 * // Register tools on the server
 * ctx.server.tool('memory_store', storeSchema, storeHandler);
 * ctx.server.tool('memory_recall', recallSchema, recallHandler);
 *
 * // Connect and start handling requests
 * await ctx.server.connect(ctx.transport);
 * ```
 */
export const createMcpContext = (): McpContext => {
    const server = createMcpServer();
    const transport = createMcpTransport();
    return { server, transport };
};
