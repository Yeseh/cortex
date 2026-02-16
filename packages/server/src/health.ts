/**
 * Health check endpoint handler for container orchestration.
 *
 * This module provides a health check response function for Kubernetes, Docker,
 * and other container orchestration systems. The endpoint reports
 * server status, version, and store count for monitoring dashboards.
 *
 * @module server/health
 *
 * @example
 * ```ts
 * // Use with Bun.serve routes
 * const config = loadServerConfig().value;
 * Bun.serve({
 *     routes: {
 *         '/health': { GET: () => createHealthResponse(config, cortex) },
 *     },
 *     fetch: () => new Response('Not Found', { status: 404 }),
 * });
 *
 * // Check health: GET /health
 * // Response: { status: "healthy", version: "1.0.0", ... }
 * ```
 */

import { SERVER_VERSION, type ServerConfig } from './config.ts';
import type { Cortex } from '@yeseh/cortex-core';

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
 * Creates a health check response for container orchestration.
 *
 * This function returns a JSON response with server health information.
 * It uses the Cortex registry to report the current store count.
 *
 * @param config - Server configuration (required, must be valid)
 * @param cortex - Cortex client instance for accessing store registry
 * @returns Response with health status
 *
 * @example
 * ```ts
 * import { createHealthResponse } from './health.ts';
 * import { loadServerConfig } from './config.ts';
 *
 * const config = loadServerConfig().value!;
 *
 * // Use with Bun.serve routes
 * Bun.serve({
 *     routes: {
 *         '/health': {
 *             GET: () => createHealthResponse(config, cortex),
 *         },
 *     },
 *     fetch: () => new Response('Not Found', { status: 404 }),
 * });
 *
 * // Kubernetes liveness probe configuration:
 * // livenessProbe:
 * //   httpGet:
 * //     path: /health
 * //     port: 3000
 * ```
 */
export const createHealthResponse = (config: ServerConfig, cortex: Cortex): Response => {
    // Count stores from Cortex registry
    const storeCount = cortex.listStores().length;

    const response: HealthResponse = {
        status: 'healthy',
        version: SERVER_VERSION,
        dataPath: config.dataPath,
        storeCount,
    };

    return Response.json(response);
};
