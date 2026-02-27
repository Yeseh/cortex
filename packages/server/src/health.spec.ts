/**
 * Tests for the health check endpoint handler.
 *
 * @module server/health.spec
 */

import { describe, expect, it } from 'bun:test';
import { SERVER_VERSION, type ServerConfig } from './config.ts';
import { createHealthResponse, type HealthResponse } from './health.ts';

const mockConfig: ServerConfig = {
    dataPath: '/tmp/test-cortex',
    port: 3000,
    host: '0.0.0.0',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    categoryMode: 'free'
};

// The health check handler doesn't invoke any cortex methods
const mockCortex = {} as any;

describe('createHealthResponse', () => {
    describe('response type', () => {
        it('should return a Response object', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });

            expect(response).toBeInstanceOf(Response);
        });

        it('should have a json() method', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });

            expect(typeof response.json).toBe('function');
        });

        it('should return a 200 OK status', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });

            expect(response.status).toBe(200);
        });
    });

    describe('response body', () => {
        it('should return JSON with status "healthy"', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.status).toBe('healthy');
        });

        it('should return JSON with the correct SERVER_VERSION', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.version).toBe(SERVER_VERSION);
            expect(json.version).toBe('1.0.0');
        });

        it('should return JSON with dataPath matching config.dataPath', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.dataPath).toBe(mockConfig.dataPath);
        });

        it('should return JSON with all required HealthResponse fields', async () => {
            const response = await createHealthResponse({ config: mockConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json).toHaveProperty('status');
            expect(json).toHaveProperty('version');
            expect(json).toHaveProperty('dataPath');
        });
    });

    describe('config handling', () => {
        it('should reflect a custom dataPath from config', async () => {
            const customConfig: ServerConfig = { ...mockConfig, dataPath: '/custom/data/path' };
            const response = await createHealthResponse({ config: customConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.dataPath).toBe('/custom/data/path');
        });

        it('should use the dataPath exactly as provided without modification', async () => {
            const dataPath = '/some/path/with spaces/and-dashes_and_underscores';
            const config: ServerConfig = { ...mockConfig, dataPath };
            const response = await createHealthResponse({ config, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.dataPath).toBe(dataPath);
        });

        it('should always return "healthy" regardless of config values', async () => {
            const minimalConfig: ServerConfig = {
                ...mockConfig,
                dataPath: '/non/existent/path',
            };
            const response = await createHealthResponse({ config: minimalConfig, cortex: mockCortex });
            const json = (await response.json()) as HealthResponse;

            expect(json.status).toBe('healthy');
        });

        it('should always return SERVER_VERSION regardless of config values', async () => {
            const config1: ServerConfig = { ...mockConfig, dataPath: '/path/one' };
            const config2: ServerConfig = { ...mockConfig, dataPath: '/path/two' };

            const [res1, res2] = await Promise.all([
                createHealthResponse({ config: config1, cortex: mockCortex }),
                createHealthResponse({ config: config2, cortex: mockCortex }),
            ]);

            const json1 = (await res1.json()) as HealthResponse;
            const json2 = (await res2.json()) as HealthResponse;

            expect(json1.version).toBe(SERVER_VERSION);
            expect(json2.version).toBe(SERVER_VERSION);
        });

        it('should return different dataPath for different configs', async () => {
            const configA: ServerConfig = { ...mockConfig, dataPath: '/data/alpha' };
            const configB: ServerConfig = { ...mockConfig, dataPath: '/data/beta' };

            const [resA, resB] = await Promise.all([
                createHealthResponse({ config: configA, cortex: mockCortex }),
                createHealthResponse({ config: configB, cortex: mockCortex }),
            ]);

            const jsonA = (await resA.json()) as HealthResponse;
            const jsonB = (await resB.json()) as HealthResponse;

            expect(jsonA.dataPath).toBe('/data/alpha');
            expect(jsonB.dataPath).toBe('/data/beta');
        });
    });
});
