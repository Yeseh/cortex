import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import {
    callTool,
    createServerSandbox,
    expectMcpSuccess,
    expectMcpToolError,
    initializeMcp,
    listTools,
    readTextContent,
    startServer,
    stopServer,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';

describe('MCP end-to-end workflow integration', () => {
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

    it('should run initialize -> tools -> store/category/memory workflow with final state checks', async () => {
        expectMcpSuccess(await initializeMcp(sandbox.baseUrl));

        const toolList = expectMcpSuccess<{ tools: Array<{ name: string }> }>(await listTools(sandbox.baseUrl));
        const toolNames = (toolList.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
        expect(toolNames).toContain('cortex_create_store');
        expect(toolNames).toContain('cortex_add_memory');

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'workflow-store' }, 70));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_set_category_description', {
            store: 'workflow-store',
            path: 'work/items',
            description: '',
        }, 71));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_add_memory', {
            store: 'workflow-store',
            path: 'work/items/task-1',
            content: 'task one content',
            tags: ['workflow'],
        }, 72));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_update_memory', {
            store: 'workflow-store',
            path: 'work/items/task-1',
            content: 'task one updated',
        }, 73));

        const fetched = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_get_memory', {
            store: 'workflow-store',
            path: 'work/items/task-1',
        }, 74));
        expect(readTextContent(fetched)).toContain('task one updated');

        const listed = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_memories', {
            store: 'workflow-store',
            category: 'work',
        }, 75));
        expect(readTextContent(listed)).toContain('work/items/task-1');

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_move_memory', {
            store: 'workflow-store',
            from_path: 'work/items/task-1',
            to_path: 'work/items/task-1-moved',
        }, 76));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_stores', {}, 77));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_get_recent_memories', {
            store: 'workflow-store',
            limit: 5,
        }, 78));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_reindex_store', {
            store: 'workflow-store',
        }, 79));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_remove_memory', {
            store: 'workflow-store',
            path: 'work/items/task-1-moved',
        }, 80));

        const removedFetch = await callTool(sandbox.baseUrl, 'cortex_get_memory', {
            store: 'workflow-store',
            path: 'work/items/task-1-moved',
        }, 81);
        expectMcpToolError(removedFetch);
    });
});
