import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ServerConfig } from './config.ts';
import { createHealthResponse, type HealthResponse } from './health.ts';

/**
 * Helper to start a Bun server on a random port and return the base URL.
 */
const startServer = (config: ServerConfig): { server: ReturnType<typeof Bun.serve>; baseUrl: string } => {
    const server = Bun.serve({
        port: 0, // Random available port
        hostname: '127.0.0.1',
        routes: {
            '/health': {
                GET: async () => createHealthResponse(config),
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
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);

            expect(response.status).toBe(200);
        });

        it('should return JSON with correct content type', async () => {
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);

            expect(response.headers.get('content-type')).toContain('application/json');
        });

        it('should return status "healthy"', async () => {
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.status).toBe('healthy');
        });

        it('should return version "1.0.0"', async () => {
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.version).toBe('1.0.0');
        });

        it('should return response with correct shape', async () => {
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json).toHaveProperty('status');
            expect(json).toHaveProperty('version');
            expect(json).toHaveProperty('dataPath');
            expect(json).toHaveProperty('storeCount');
            expect(typeof json.status).toBe('string');
            expect(typeof json.version).toBe('string');
            expect(typeof json.dataPath).toBe('string');
            expect(typeof json.storeCount).toBe('number');
        });
    });

    describe('config handling', () => {
        it('should use provided config dataPath', async () => {
            const customDataPath = join(tempDir, 'custom-data');
            const customConfig: ServerConfig = {
                ...config,
                dataPath: customDataPath,
            };

            const { server: s, baseUrl } = startServer(customConfig);
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

            const { server: s1, baseUrl: baseUrl1 } = startServer(config1);
            const { server: s2, baseUrl: baseUrl2 } = startServer(config2);

            try {
                const response1 = await fetch(`${baseUrl1}/health`);
                const json1 = (await response1.json()) as HealthResponse;

                const response2 = await fetch(`${baseUrl2}/health`);
                const json2 = (await response2.json()) as HealthResponse;

                expect(json1.dataPath).toBe(dataPath1);
                expect(json2.dataPath).toBe(dataPath2);
            }
            finally {
                s1.stop();
                s2.stop();
            }
            server = null; // Already stopped both servers
        });
    });

    describe('store counting', () => {
        it('should return storeCount 0 when no stores.yaml exists', async () => {
            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.storeCount).toBe(0);
        });

        it('should count stores correctly when registry exists with one store', async () => {
            const storePath = join(tempDir, 'stores', 'test');
            const storesYaml = `settings:
  output_format: yaml
  auto_summary: false
  strict_local: false
stores:
  test-store:
    path: ${storePath}
`;
            await writeFile(join(tempDir, 'stores.yaml'), storesYaml);

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.storeCount).toBe(1);
        });

        it('should count stores correctly when registry exists with multiple stores', async () => {
            const storePath1 = join(tempDir, 'stores', 'test');
            const storePath2 = join(tempDir, 'stores', 'another');
            const storePath3 = join(tempDir, 'stores', 'third');
            const storesYaml = `settings:
  output_format: yaml
  auto_summary: false
  strict_local: false
stores:
  test-store:
    path: ${storePath1}
  another-store:
    path: ${storePath2}
  third-store:
    path: ${storePath3}
`;
            await writeFile(join(tempDir, 'stores.yaml'), storesYaml);

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.storeCount).toBe(3);
        });

        it('should count stores correctly with two stores', async () => {
            const storesYaml = `settings:
  output_format: yaml
  auto_summary: false
  strict_local: false
stores:
  primary:
    path: /var/lib/cortex
  secondary:
    path: /var/lib/cortex-secondary
`;
            await writeFile(join(tempDir, 'stores.yaml'), storesYaml);

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(json.storeCount).toBe(2);
        });
    });

    describe('error resilience', () => {
        it('should return healthy even if store registry has invalid content', async () => {
            const invalidYaml = `invalid yaml content
not a valid stores file
{{{
`;
            await writeFile(join(tempDir, 'stores.yaml'), invalidYaml);

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.storeCount).toBe(0);
        });

        it('should return healthy with storeCount 0 when registry is empty file', async () => {
            await writeFile(join(tempDir, 'stores.yaml'), '');

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.storeCount).toBe(0);
        });

        it('should return healthy when dataPath directory does not exist', async () => {
            const nonExistentPath = join(tempDir, 'non-existent-dir', 'deep', 'path');
            const configWithBadPath: ServerConfig = {
                ...config,
                dataPath: nonExistentPath,
            };

            const { server: s, baseUrl } = startServer(configWithBadPath);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.dataPath).toBe(nonExistentPath);
            expect(json.storeCount).toBe(0);
        });

        it('should return healthy with storeCount 0 when stores.yaml contains only comments', async () => {
            const commentOnlyYaml = `# This is a comment
# Another comment
`;
            await writeFile(join(tempDir, 'stores.yaml'), commentOnlyYaml);

            const { server: s, baseUrl } = startServer(config);
            server = s;

            const response = await fetch(`${baseUrl}/health`);
            const json = (await response.json()) as HealthResponse;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.storeCount).toBe(0);
        });
    });
});
