import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    createServerSandbox,
    expectMcpSuccess,
    initializeMcp,
    listTools,
    startServer,
    stopServer,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';
import { rm } from 'node:fs/promises';

describe('MCP server bootstrap integration', () => {
    let sandbox: ServerSandbox;
    let server: StartedServer;

    beforeEach(async () => {
        sandbox = await createServerSandbox();
        server = await startServer(sandbox);
    });

    afterEach(async () => {
        await stopServer(server);
        await rm(sandbox.rootDir, { recursive: true, force: true });
    });

    it('should initialize MCP session successfully', async () => {
        const initResponse = await initializeMcp(sandbox.baseUrl);
        const init = expectMcpSuccess<{ protocolVersion: string }>(initResponse);

        expect((init.result as { protocolVersion?: string }).protocolVersion).toBeTruthy();
    });

    it('should list expected tool families after initialize', async () => {
        expectMcpSuccess(await initializeMcp(sandbox.baseUrl));

        const toolsResponse = await listTools(sandbox.baseUrl);
        const tools = expectMcpSuccess<{ tools: Array<{ name: string }> }>(toolsResponse);
        const names = (tools.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

        expect(names).toContain('cortex_add_memory');
        expect(names).toContain('cortex_get_memory');
        expect(names).toContain('cortex_list_stores');
        expect(names).toContain('cortex_create_store');
        expect(names).toContain('cortex_set_category_description');

        if (names.includes('cortex_create_category') || names.includes('cortex_delete_category')) {
            expect(names).toContain('cortex_create_category');
            expect(names).toContain('cortex_delete_category');
        }
    });
});
