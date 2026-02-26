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

describe('MCP memory tools integration', () => {
    let sandbox: ServerSandbox;
    let server: StartedServer;

    beforeEach(async () => {
        sandbox = await createServerSandbox();
        server = await startServer(sandbox);
        expectMcpSuccess(await initializeMcp(sandbox.baseUrl));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_create_store', { name: 'mem-store' }, 40));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_set_category_description', {
            store: 'mem-store',
            path: 'notes',
            description: '',
        }, 401));
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_set_category_description', {
            store: 'mem-store',
            path: 'history',
            description: '',
        }, 402));
    });

    afterEach(async () => {
        await stopServer(server);
        await rm(sandbox.rootDir, { recursive: true, force: true });
    });

    it('should support add/get/list/update/move/remove memory flow', async () => {
        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_add_memory', {
            store: 'mem-store',
            path: 'notes/alpha',
            content: 'first content',
            tags: ['alpha'],
        }, 41));

        const fetched = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_get_memory', {
            store: 'mem-store',
            path: 'notes/alpha',
        }, 42));
        const fetchedJson = JSON.parse(readTextContent(fetched)) as { content: string; metadata: { tags: string[] } };
        expect(fetchedJson.content).toContain('first content');
        expect(fetchedJson.metadata.tags).toContain('alpha');

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_update_memory', {
            store: 'mem-store',
            path: 'notes/alpha',
            content: 'updated content',
            tags: ['beta'],
        }, 43));

        const listed = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_memories', {
            store: 'mem-store',
            category: 'notes',
        }, 44));
        const listJson = JSON.parse(readTextContent(listed)) as { count: number; memories: Array<{ path: string }> };
        expect(listJson.count).toBeGreaterThanOrEqual(1);
        expect(listJson.memories.some((memory) => memory.path === 'notes/alpha')).toBe(true);

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_move_memory', {
            store: 'mem-store',
            from_path: 'notes/alpha',
            to_path: 'notes/alpha-renamed',
        }, 45));

        const moved = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_get_memory', {
            store: 'mem-store',
            path: 'notes/alpha-renamed',
        }, 46));
        expect(readTextContent(moved)).toContain('updated content');

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_remove_memory', {
            store: 'mem-store',
            path: 'notes/alpha-renamed',
        }, 47));

        const finalList = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_list_memories', {
            store: 'mem-store',
            category: 'notes',
        }, 48));
        const finalJson = JSON.parse(readTextContent(finalList)) as { memories: Array<{ path: string }> };
        expect(finalJson.memories.some((memory) => memory.path === 'notes/alpha-renamed')).toBe(false);
    });

    it('should support prune dry-run and apply, plus recent and reindex responses', async () => {
        const oldDate = '2001-01-01T00:00:00.000Z';

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_add_memory', {
            store: 'mem-store',
            path: 'history/expired-memory',
            content: 'expired',
            expires_at: oldDate,
        }, 49));

        expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_add_memory', {
            store: 'mem-store',
            path: 'history/current-memory',
            content: 'current',
        }, 50));

        const dryRun = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_prune_memories', {
            store: 'mem-store',
            dry_run: true,
        }, 51));
        const dryRunJson = JSON.parse(readTextContent(dryRun)) as {
            dry_run: boolean;
            would_prune_count: number;
        };
        expect(dryRunJson.dry_run).toBe(true);
        expect(dryRunJson.would_prune_count).toBeGreaterThanOrEqual(1);

        const applied = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_prune_memories', {
            store: 'mem-store',
            dry_run: false,
        }, 52));
        const appliedJson = JSON.parse(readTextContent(applied)) as { pruned_count: number };
        expect(appliedJson.pruned_count).toBeGreaterThanOrEqual(1);

        const recent = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_get_recent_memories', {
            store: 'mem-store',
            limit: 5,
        }, 53));
        const recentJson = JSON.parse(readTextContent(recent)) as {
            count: number;
            memories: Array<{ path: string }>;
        };
        expect(recentJson.count).toBeGreaterThanOrEqual(1);
        expect(recentJson.memories.some((memory) => memory.path === 'history/current-memory')).toBe(true);

        const reindex = expectMcpSuccess(await callTool(sandbox.baseUrl, 'cortex_reindex_store', {
            store: 'mem-store',
        }, 54));
        const reindexJson = JSON.parse(readTextContent(reindex)) as {
            store: string;
            warnings: string[];
        };
        expect(reindexJson.store).toBe('mem-store');
        expect(Array.isArray(reindexJson.warnings)).toBe(true);
    });
});
