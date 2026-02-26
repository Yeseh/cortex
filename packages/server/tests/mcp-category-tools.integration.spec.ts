import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import {
    callTool,
    createServerSandbox,
    expectMcpSuccess,
    expectMcpToolError,
    initializeMcp,
    startServer,
    stopServer,
    readTextContent,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';

describe('MCP category tools integration', () => {
    let sandbox: ServerSandbox;
    let server: StartedServer;

    beforeEach(async () => {
        sandbox = await createServerSandbox();
        server = await startServer(sandbox);
        expectMcpSuccess(await initializeMcp(sandbox.baseUrl));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'cats-store' }, 30));
    });

    afterEach(async () => {
        await stopServer(server);
        await rm(sandbox.rootDir, { recursive: true, force: true });
    });

    it('should create, describe, and delete a category', async () => {
        const create = expectMcpSuccess(
            await callTool(sandbox.baseUrl, 'cortex_create_category', {
                store: 'cats-store',
                path: 'projects/demo',
            }, 31),
        );
        const createJson = JSON.parse(readTextContent(create)) as { path: string; created: boolean };
        expect(createJson.path).toBe('projects/demo');

        const describeResult = expectMcpSuccess(
            await callTool(sandbox.baseUrl, 'cortex_set_category_description', {
                store: 'cats-store',
                path: 'projects/demo',
                description: 'demo category',
            }, 32),
        );
        const descriptionJson = JSON.parse(readTextContent(describeResult)) as {
            path: string;
            description: string | null;
        };
        expect(descriptionJson.path).toBe('projects/demo');
        expect(descriptionJson.description).toBe('demo category');

        const deleted = expectMcpSuccess(
            await callTool(sandbox.baseUrl, 'cortex_delete_category', {
                store: 'cats-store',
                path: 'projects/demo',
            }, 33),
        );
        const deletedJson = JSON.parse(readTextContent(deleted)) as { path: string; deleted: boolean };
        expect(deletedJson.deleted).toBe(true);
    });

    it('should map invalid category path to MCP invalid params error', async () => {
        const response = await callTool(
            sandbox.baseUrl,
            'cortex_create_category',
            {
                store: 'cats-store',
                path: '',
            },
            34,
        );

        expectMcpToolError(response, 'Category path is required');
    });
});
