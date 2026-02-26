import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    createServerSandbox,
    startServer,
    stopServer,
    type ServerSandbox,
    type StartedServer,
} from './test-helpers';
import { rm } from 'node:fs/promises';

describe('MCP server health endpoint integration', () => {
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

    it('should return healthy status from GET /health', async () => {
        const response = await fetch(`${sandbox.baseUrl}/health`);
        const body = await response.json() as {
            status: string;
            version: string;
            dataPath: string;
        };

        expect(response.status).toBe(200);
        expect(body.status).toBe('healthy');
        expect(body.version.length).toBeGreaterThan(0);
        expect(body.dataPath).toBe(sandbox.dataPath);
    });

    it('should return 404 for unknown route', async () => {
        const response = await fetch(`${sandbox.baseUrl}/not-a-route`);
        const body = await response.text();

        expect(response.status).toBe(404);
        expect(body).toContain('Not Found');
    });
});
