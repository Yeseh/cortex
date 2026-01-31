/**
 * Health check endpoint handler for container orchestration.
 *
 * This module provides a health check router for Kubernetes, Docker,
 * and other container orchestration systems. The endpoint reports
 * server status, version, and store count for monitoring dashboards.
 *
 * @module server/health
 *
 * @example
 * ```ts
 * // Mount health router in Express app
 * const config = loadServerConfig().value;
 * app.use('/health', createHealthRouter(config));
 *
 * // Check health: GET /health
 * // Response: { status: "healthy", version: "1.0.0", ... }
 * ```
 */

import { Router, type Request, type Response } from 'express';
import { resolve } from 'node:path';
import { SERVER_VERSION, type ServerConfig } from './config.ts';
import { FilesystemRegistry } from '../core/storage/filesystem/index.ts';

/**
 * Health check response structure.
 *
 * This interface defines the JSON response returned by the `/health`
 * endpoint. It provides essential information for monitoring systems
 * and operational dashboards.
 */
export interface HealthResponse {
    /**
     * Current server health status.
     * - `healthy` - Server is operational and can handle requests
     * - `unhealthy` - Server has issues (currently always returns healthy)
     */
    status: 'healthy' | 'unhealthy';

    /** Server version string (matches MCP protocol version) */
    version: string;

    /** Configured data directory path for memory stores */
    dataPath: string;

    /** Number of memory stores currently registered (0 if registry unavailable) */
    storeCount: number;
}

/**
 * Creates a health check router for container orchestration.
 *
 * The router provides a single GET endpoint that returns server health
 * information. It attempts to load the store registry to report the
 * current store count, but gracefully handles missing registries.
 *
 * @param config - Server configuration (required, must be valid)
 * @returns Express router for mounting at the health endpoint
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createHealthRouter } from './health.ts';
 * import { loadServerConfig } from './config.ts';
 *
 * const app = express();
 * const config = loadServerConfig().value!;
 *
 * // Mount at /health
 * app.use('/health', createHealthRouter(config));
 *
 * // Kubernetes liveness probe configuration:
 * // livenessProbe:
 * //   httpGet:
 * //     path: /health
 * //     port: 3000
 * ```
 */
export const createHealthRouter = (config: ServerConfig): Router => {
    const router = Router();

    router.get(
        '/', async (
            _req: Request, res: Response,
        ) => {
        // Try to load store registry and count stores
            const registryPath = resolve(
                config.dataPath, 'stores.yaml',
            );
            const registry = new FilesystemRegistry(registryPath);
            const registryResult = await registry.load();
            // Treat REGISTRY_MISSING as 0 stores (like allowMissing: true did)
            const storeCount = registryResult.ok ? Object.keys(registryResult.value).length : 0;

            const response: HealthResponse = {
                status: 'healthy',
                version: SERVER_VERSION,
                dataPath: config.dataPath,
                storeCount,
            };

            res.json(response);
        },
    );

    return router;
};
