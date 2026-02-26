import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import {
    callTool,
    createServerSandbox,
    expectMcpError,
    expectMcpSuccess,
    expectMcpToolError,
    initializeMcp,
    postMcp,
    startServer,
    stopServer,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';

describe('MCP error handling integration', () => {
    let sandbox: ServerSandbox;
    let server: StartedServer;

    beforeEach(async () => {
        sandbox = await createServerSandbox();
        server = await startServer(sandbox);
        expectMcpSuccess(await initializeMcp(sandbox.baseUrl));
    });

    afterEach(async () => {
        await stopServer(server);
        await rm(sandbox.rootDir, { recursive: true, force: true });
    });

    it('should return invalid params for missing required tool arguments', async () => {
        const response = await callTool(
            sandbox.baseUrl,
            'cortex_get_memory',
            { store: 'default' },
            60,
        );

        expectMcpToolError(response);
    });

    it('should return protocol error for unknown tool', async () => {
        const response = await callTool(
            sandbox.baseUrl,
            'cortex_tool_does_not_exist',
            {},
            61,
        );

        expectMcpToolError(response, 'not found');
    });

    it('should return actionable messages for invalid store and path inputs', async () => {
        const invalidStore = await callTool(
            sandbox.baseUrl,
            'cortex_list_memories',
            { store: 'missing-store', category: 'notes' },
            62,
        );
        expectMcpToolError(invalidStore, 'Store');

        const invalidPath = await callTool(
            sandbox.baseUrl,
            'cortex_create_category',
            { store: 'default', path: '   ' },
            63,
        );
        expectMcpToolError(invalidPath, 'Category path is required');
    });

    it('should reject oversized MCP request body with 413', async () => {
        const oversizedPayload = JSON.stringify({
            jsonrpc: '2.0',
            id: 64,
            method: 'tools/call',
            params: {
                name: 'cortex_list_stores',
                arguments: {
                    huge: 'x'.repeat(1024 * 1024 + 128),
                },
            },
        });

        const response = await fetch(`${sandbox.baseUrl}/mcp`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: oversizedPayload,
        });

        const body = await response.json() as { error?: string };
        expect(response.status).toBe(413);
        expect(body.error).toContain('too large');
    });

    it('should surface unknown JSON-RPC method errors', async () => {
        const response = await postMcp(sandbox.baseUrl, 'method/does-not-exist', {}, 65);
        expectMcpError(response);
    });
});
