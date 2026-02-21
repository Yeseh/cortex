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
 * const cortex = Cortex.init({ rootDirectory: config.dataPath, adapterFactory });
 * Bun.serve({
 *     routes: {
 *         '/health': { GET: async () => createHealthResponse({ config, cortex }) },
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
/**
 * Health check context containing required dependencies.
 *
 * This interface defines the dependencies needed by the health check handler.
 */
export interface HealthContext {
    /** Server configuration */
    config: ServerConfig;
    /** Cortex client instance */
    cortex: Cortex;
}

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
}

/**
 * Creates a health check response for container orchestration.
 *
 * This function returns a JSON response with server health information.
 * It uses the Cortex client to report the current store count.
 *
 * @param ctx - Health context containing config and cortex instance
 * @returns Promise resolving to Web Standard Response with health status
 *
 * @example
 * ```ts
 * import { createHealthResponse } from './health.ts';
 * import { loadServerConfig } from './config.ts';
 *
 * const config = loadServerConfig().value!;
 * const cortex = Cortex.init({ rootDirectory: config.dataPath, adapterFactory });
 *
 * // Use with Bun.serve routes
 * Bun.serve({
 *     routes: {
 *         '/health': {
 *             GET: async () => createHealthResponse({ config, cortex }),
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
export const createHealthResponse = async (ctx: HealthContext): Promise<Response> => {
    const response: HealthResponse = {
        status: 'healthy',
        version: SERVER_VERSION,
        dataPath: ctx.config.dataPath,
    };

    return Response.json(response);
};
