/**
 * Environment variable configuration parsing for the MCP server.
 *
 * This module provides type-safe configuration loading from environment
 * variables with sensible defaults. All configuration is validated using
 * Zod schemas to ensure type safety at runtime.
 *
 * @module server/config
 *
 * @example
 * ```ts
 * // Set environment variables before starting server
 * process.env.CORTEX_PORT = '8080';
 * process.env.CORTEX_LOG_LEVEL = 'debug';
 *
 * const result = loadServerConfig();
 * if (result.ok) {
 *   console.log(`Port: ${result.value.port}`); // 8080
 * }
 * ```
 */

import { z } from 'zod';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Result } from '../core/types.ts';
/**
 * Default cortex config directory path.
 *
 * Uses the XDG-compliant global config directory:
 * `~/.config/cortex/`
 *
 * This aligns with the global config directory layout defined in the specs:
 * - `~/.config/cortex/config.yaml` - global configuration
 * - `~/.config/cortex/stores.yaml` - store registry
 * - `~/.config/cortex/memory/` - default global store root (where stores are subdirectories)
 */
export const getDefaultDataPath = (): string => join(homedir(), '.config', 'cortex');

/**
 * Default subdirectory within the data path where memory stores are located.
 */
export const MEMORY_SUBDIR = 'memory';

/** Server name for MCP protocol identification */
export const SERVER_NAME = 'cortex-memory';

/** Server version reported in health checks and MCP protocol responses */
export const SERVER_VERSION = '1.0.0';

/**
 * Log verbosity levels from most to least verbose.
 * - `debug` - Detailed debugging information
 * - `info` - General operational information
 * - `warn` - Warning conditions that should be reviewed
 * - `error` - Error conditions that need attention
 */
export const logLevelSchema = z.enum([
    'debug',
    'info',
    'warn',
    'error',
]);

/** Log verbosity level */
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * Output format options for CLI and API responses.
 * - `yaml` - Human-readable YAML format (default)
 * - `json` - Machine-readable JSON format
 * - `toon` - Token-optimized format for LLM consumption (~40% token reduction)
 */
export const outputFormatSchema = z.enum([
    'yaml',
    'json',
    'toon',
]);

/** Output format type */
export type OutputFormat = z.infer<typeof outputFormatSchema>;

/**
 * Creates the server configuration schema with environment variable defaults.
 *
 * Each field maps to a `CORTEX_*` environment variable:
 * - `dataPath` ← `CORTEX_DATA_PATH` - Base cortex config directory (default: "~/.config/cortex/")
 * - `port` ← `CORTEX_PORT` - HTTP server port (default: 3000)
 * - `host` ← `CORTEX_HOST` - Network interface to bind (default: "0.0.0.0")
 * - `defaultStore` ← `CORTEX_DEFAULT_STORE` - Default memory store name (default: "default")
 * - `logLevel` ← `CORTEX_LOG_LEVEL` - Logging verbosity (default: "info")
 * - `outputFormat` ← `CORTEX_OUTPUT_FORMAT` - Response format (default: "yaml")
 * - `autoSummaryThreshold` ← `CORTEX_AUTO_SUMMARY_THRESHOLD` - Token count triggering auto-summary (default: 500)
 *
 * Note: The dataPath default is computed at runtime to resolve the user's home directory.
 * Memory stores are located at `${dataPath}/memory/` by default.
 */
export const createServerConfigSchema = () =>
    z.object({
        /** Base cortex config directory path */
        dataPath: z.string().default(getDefaultDataPath()),
        /** HTTP server port number */
        port: z.coerce.number().int().positive().default(3000),
        // Default to all interfaces for container deployment
        // Set CORTEX_HOST=127.0.0.1 for local development
        /** Network interface to bind (use "127.0.0.1" for local-only access) */
        host: z.string().default('0.0.0.0'),
        /** Name of the default memory store (aligns with global config convention) */
        defaultStore: z.string().default('default'),
        /** Logging verbosity level */
        logLevel: logLevelSchema.default('info'),
        /** Output format for responses */
        outputFormat: outputFormatSchema.default('yaml'),
        /** Token count threshold that triggers automatic summarization */
        autoSummaryThreshold: z.coerce.number().int().nonnegative().default(500),
    });

/**
 * Server configuration schema with environment variable defaults.
 * @deprecated Use createServerConfigSchema() for runtime defaults
 */
export const serverConfigSchema = createServerConfigSchema();

/**
 * Parsed server configuration object.
 *
 * @see {@link serverConfigSchema} for field descriptions and defaults
 */
export type ServerConfig = z.infer<typeof serverConfigSchema>;

/**
 * Gets the memory storage path from server config.
 *
 * Combines the base `dataPath` with the `memory` subdirectory to get
 * the root directory where memory stores are located.
 *
 * @param config - Server configuration object
 * @returns Full path to the memory storage directory
 *
 * @example
 * ```ts
 * const config = { dataPath: '/home/user/.config/cortex', ... };
 * const memoryPath = getMemoryPath(config);
 * // Returns: '/home/user/.config/cortex/memory'
 * ```
 */
export const getMemoryPath = (config: ServerConfig): string => join(config.dataPath, MEMORY_SUBDIR);

/** Error codes for configuration loading failures */
export type ConfigLoadErrorCode = 'CONFIG_VALIDATION_FAILED';

/**
 * Error details for configuration loading failures.
 *
 * Contains the error code, human-readable message, and optionally
 * the detailed Zod validation issues for debugging.
 */
export interface ConfigLoadError {
    /** Error classification code */
    code: ConfigLoadErrorCode;
    /** Human-readable error description */
    message: string;
    /** Detailed Zod validation issues (when validation fails) */
    issues?: z.ZodIssue[];
}

/**
 * Loads server configuration from environment variables.
 *
 * Maps the following environment variables to configuration values:
 *
 * | Environment Variable | Config Field | Default |
 * |---------------------|--------------|---------|
 * | `CORTEX_DATA_PATH` | `dataPath` | "~/.config/cortex/" |
 * | `CORTEX_PORT` | `port` | 3000 |
 * | `CORTEX_HOST` | `host` | "0.0.0.0" |
 * | `CORTEX_DEFAULT_STORE` | `defaultStore` | "default" |
 * | `CORTEX_LOG_LEVEL` | `logLevel` | "info" |
 * | `CORTEX_OUTPUT_FORMAT` | `outputFormat` | "yaml" |
 * | `CORTEX_AUTO_SUMMARY_THRESHOLD` | `autoSummaryThreshold` | 500 |
 *
 * Note: Memory stores are located at `${dataPath}/memory/`. Use `getMemoryPath(config)`
 * to get the full memory storage path.
 *
 * @returns Result containing parsed config or validation error
 *
 * @example
 * ```ts
 * const result = loadServerConfig();
 * if (result.ok) {
 *   console.log(`Server will listen on ${result.value.host}:${result.value.port}`);
 *   console.log(`Memory stored at: ${getMemoryPath(result.value)}`);
 * } else {
 *   console.error(`Config error: ${result.error.message}`);
 *   result.error.issues?.forEach(issue => {
 *     console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
 *   });
 * }
 * ```
 */
export const loadServerConfig = (): Result<ServerConfig, ConfigLoadError> => {
    const rawConfig = {
        dataPath: process.env.CORTEX_DATA_PATH,
        port: process.env.CORTEX_PORT,
        host: process.env.CORTEX_HOST,
        defaultStore: process.env.CORTEX_DEFAULT_STORE,
        logLevel: process.env.CORTEX_LOG_LEVEL,
        outputFormat: process.env.CORTEX_OUTPUT_FORMAT,
        autoSummaryThreshold: process.env.CORTEX_AUTO_SUMMARY_THRESHOLD,
    };

    // Create schema at runtime to get correct homedir() default
    const schema = createServerConfigSchema();
    const result = schema.safeParse(rawConfig);

    if (!result.success) {
        return {
            ok: false,
            error: {
                code: 'CONFIG_VALIDATION_FAILED',
                message: 'Invalid server configuration.',
                issues: result.error.issues,
            },
        };
    }

    return { ok: true, value: result.data };
};
