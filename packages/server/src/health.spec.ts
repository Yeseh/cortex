import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ServerConfig } from './config.ts';
import { MEMORY_SUBDIR } from './config.ts';
import { createHealthResponse, type HealthContext, type HealthResponse } from './health.ts';
import { Cortex } from '@yeseh/cortex-core';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

/**
 * Creates a HealthContext for testing.
 */
const createTestContext = async (tempDir: string, config: ServerConfig): Promise<HealthContext> => {
    const memoryDir = join(tempDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });

    const cortex = Cortex.init({
        adapterFactory: (storePath: string) =>
            new FilesystemStorageAdapter({ rootDirectory: storePath }),
    });

    return { config, cortex };
};

/**
 * Helper to start a Bun server on a random port and return the base URL.
 */
const startServer = (
    ctx: HealthContext
): { server: ReturnType<typeof Bun.serve>; baseUrl: string } => {
    const server = Bun.serve({
        port: 0, // Random available port
        hostname: '127.0.0.1',
        routes: {
            '/health': {
                GET: async () => createHealthResponse(ctx),
            },
        },
        fetch: () => new Response('Not Found', { status: 404 }),
    });
    return { server, baseUrl: `http://127.0.0.1:${server.port}` };
};

describe('health endpoint', () => {
    let tempDir: string;
    let config: ServerConfig;
    let server: ReturnType<typeof Bun.serve> | null = null;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-health-tests-'));
        config = {
            dataPath: tempDir,
            port: 3000,
            host: '0.0.0.0',
            defaultStore: 'default',
            logLevel: 'info',
            outputFormat: 'yaml',
            autoSummaryThreshold: 500,
        };
    });

    afterEach(async () => {
        if (server) {
            server.stop();
            server = null;
        }
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('basic health response', () => {
        it('should return 200 status', async () => {
            const ctx = await createTestContext(tempDir, config);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);

            expect(response.status).toBe(200);
        });

        it('should return JSON with correct content type', async () => {
            const ctx = await createTestContext(tempDir, config);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);

            expect(response.headers.get('content-type')).toContain('application/json');
        });

        it('should return status "healthy"', async () => {
            const ctx = await createTestContext(tempDir, config);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.status).toBe('healthy');
        });

        it('should return version "1.0.0"', async () => {
            const ctx = await createTestContext(tempDir, config);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.version).toBe('1.0.0');
        });

        it('should return response with correct shape', async () => {
            const ctx = await createTestContext(tempDir, config);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json).toHaveProperty('status');
            expect(json).toHaveProperty('version');
            expect(json).toHaveProperty('dataPath');
            expect(typeof json.status).toBe('string');
            expect(typeof json.version).toBe('string');
            expect(typeof json.dataPath).toBe('string');
        });
    });

    describe('config handling', () => {
        it('should use provided config dataPath', async () => {
            const customDataPath = join(tempDir, 'custom-data');
            const customConfig: ServerConfig = {
                ...config,
                dataPath: customDataPath,
            };

            const ctx = await createTestContext(tempDir, customConfig);
            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.dataPath).toBe(customDataPath);
        });

        it('should use different dataPath for different configs', async () => {
            const dataPath1 = join(tempDir, 'data-one');
            const dataPath2 = join(tempDir, 'data-two');

            const config1: ServerConfig = { ...config, dataPath: dataPath1 };
            const config2: ServerConfig = { ...config, dataPath: dataPath2 };

            const ctx1 = await createTestContext(dataPath1, config1);
            const ctx2 = await createTestContext(dataPath2, config2);

            const { server: s1, baseUrl: baseUrl1 } = startServer(ctx1);
            const { server: s2, baseUrl: baseUrl2 } = startServer(ctx2);

            try {
                const response1 = await fetch(`${baseUrl1}/health`);
                const json1 = (await response1.json()) as HealthResponse;

                const response2 = await fetch(`${baseUrl2}/health`);
                const json2 = (await response2.json()) as HealthResponse;

                expect(json1.dataPath).toBe(dataPath1);
                expect(json2.dataPath).toBe(dataPath2);
            } finally {
                s1.stop();
                s2.stop();
            }
            server = null; // Already stopped both servers
        });
    });

    describe('error resilience', () => {
        it('should return healthy when dataPath directory does not exist', async () => {
            const nonExistentPath = join(tempDir, 'non-existent-dir', 'deep', 'path');
            const configWithBadPath: ServerConfig = {
                ...config,
                dataPath: nonExistentPath,
            };

            // Create context with non-existent path - cortex should still work
            const cortex = Cortex.init({
                adapterFactory: (storePath: string) =>
                    new FilesystemStorageAdapter({ rootDirectory: storePath }),
            });
            const ctx: HealthContext = { config: configWithBadPath, cortex };

            const { server: s, baseUrl } = startServer(ctx);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.dataPath).toBe(nonExistentPath);
        });
    });
});
