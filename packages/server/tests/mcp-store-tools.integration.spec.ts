import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import {
    callTool,
    createServerSandbox,
    expectMcpSuccess,
    initializeMcp,
    readTextContent,
    startServer,
    stopServer,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';

describe('MCP store tools integration', () => {
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

    it('should list stores, create a store, and include it in subsequent listings', async () => {
        const beforeList = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_stores', {}, 10));
        const beforeJson = JSON.parse(readTextContent(beforeList)) as { stores: Array<{ name: string }> };
        const beforeNames = beforeJson.stores.map((store) => store.name);

        const createResult = expectMcpSuccess(
            await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'integration-store' }, 11),
        );
        const createJson = JSON.parse(readTextContent(createResult)) as { created: string };
        expect(createJson.created).toBe('integration-store');

        const afterList = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_stores', {}, 12));
        const afterJson = JSON.parse(readTextContent(afterList)) as { stores: Array<{ name: string }> };
        const afterNames = afterJson.stores.map((store) => store.name);

        expect(afterNames).toContain('integration-store');
        expect(afterNames.length).toBeGreaterThanOrEqual(beforeNames.length + 1);
    });

    it('should return duplicate-store error on second create', async () => {
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'dupe-store' }, 20));

        const duplicate = expectMcpSuccess(
            await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'dupe-store' }, 21),
        );
        const text = readTextContent(duplicate);

        expect(text).toContain('Error:');
        expect(text).toContain('already exists');
    });
});
