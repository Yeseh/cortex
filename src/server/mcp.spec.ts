import { describe, expect, it } from 'bun:test';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpContext, createMcpServer, createMcpTransport } from './mcp.ts';

// Access private server info for testing (runtime accessible but not typed)
type ServerWithInfo = { _serverInfo: { name: string; version: string } };

describe(
    'MCP server setup', () => {
        describe(
            'createMcpServer', () => {
                it(
                    'should return an McpServer instance', () => {
                        const server = createMcpServer();

                        expect(server).toBeInstanceOf(McpServer);
                    },
                );

                it(
                    'should have correct server name', () => {
                        const server = createMcpServer();
                        const serverInfo = (server.server as unknown as ServerWithInfo)._serverInfo;

                        expect(serverInfo.name).toBe('cortex-memory');
                    },
                );

                it(
                    'should have correct server version', () => {
                        const server = createMcpServer();
                        const serverInfo = (server.server as unknown as ServerWithInfo)._serverInfo;

                        expect(serverInfo.version).toBe('1.0.0');
                    },
                );
            },
        );

        describe(
            'createMcpTransport', () => {
                it(
                    'should return a StreamableHTTPServerTransport instance', () => {
                        const transport = createMcpTransport();

                        expect(transport).toBeInstanceOf(StreamableHTTPServerTransport);
                    },
                );

                it(
                    'should be configured for stateless operation', () => {
                        const transport = createMcpTransport();

                        // Stateless transports have no session ID generator, meaning sessionId will be undefined
                        expect(transport.sessionId).toBeUndefined();
                    },
                );
            },
        );

        describe(
            'createMcpContext', () => {
                it(
                    'should return an object with server and transport properties', () => {
                        const context = createMcpContext();

                        expect(context).toHaveProperty('server');
                        expect(context).toHaveProperty('transport');
                    },
                );

                it(
                    'should return an McpServer instance as server', () => {
                        const context = createMcpContext();

                        expect(context.server).toBeInstanceOf(McpServer);
                    },
                );

                it(
                    'should return a StreamableHTTPServerTransport instance as transport', () => {
                        const context = createMcpContext();

                        expect(context.transport).toBeInstanceOf(StreamableHTTPServerTransport);
                    },
                );
            },
        );

        describe(
            'server-transport integration', () => {
                it(
                    'should allow connecting server to transport', async () => {
                        const context = createMcpContext();

                        // Connect should not throw
                        await context.server.connect(context.transport);

                        // Clean up
                        await context.server.close();
                    },
                );

                it(
                    'should create independent instances on each call', () => {
                        const context1 = createMcpContext();
                        const context2 = createMcpContext();

                        expect(context1.server).not.toBe(context2.server);
                        expect(context1.transport).not.toBe(context2.transport);
                    },
                );
            },
        );
    },
);
