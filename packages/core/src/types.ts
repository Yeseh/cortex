/**
 * Cortex module types and interfaces.
 *
 * @module core/cortex/types
 */

import type { StorageAdapter, ConfigAdapter } from '@/storage/index.ts';
import type { Cortex } from './cortex.ts';
import type { CortexSettings, ConfigStores } from '@/config/types.ts';

/**
 * Factory function for creating scoped storage adapters.
 *
 * @param storeName - The logical store name
 * @returns A scoped storage adapter for the store
 *
 * @example
 * ```typescript
 * // Default filesystem adapter factory
 * const defaultFactory: AdapterFactory = (storeName) =>
 *     createAdapterForStore(storeName);
 *
 * // Mock adapter factory for testing
 * const mockFactory: AdapterFactory = (_storeName) => ({
 *     memories: mockMemoryStorage,
 *     indexes: mockIndexStorage,
 *     categories: mockCategoryStorage,
 *     config: mockConfigStorage,
 * });
 * ```
 */
export type AdapterFactory = (storeName: string) => StorageAdapter;

/**
 * Options for programmatic Cortex creation via `Cortex.init()`.
 *
 * @module core/cortex/types
 *
 * @example
 * ```typescript
 * // Minimal options
 * const options: CortexOptions = {
 *     adapterFactory: (storeName) => createAdapterForStore(storeName),
 * };
 *
 * // Full options
 * const testOptions: CortexOptions = {
 *     settings: { outputFormat: 'json' },
 *     stores: {
 *         'test-store': {
 *             kind: 'filesystem',
 *             categoryMode: 'free',
 *             categories: {},
 *             properties: { path: '/data/test-store' },
 *         },
 *     },
 *     adapterFactory: (storeName) => createAdapterForStore(storeName),
 * };
 * ```
 */
export interface CortexOptions {
    /**
     * Override default settings.
     * Unspecified fields use defaults from `DEFAULT_SETTINGS`.
     */
    settings?: Partial<CortexSettings> | undefined;

    /**
     * Store definitions mapping store names to their configuration.
        * Default: empty map `{}`
     */
    stores?: ConfigStores | undefined;

    /**
     * Custom adapter factory for creating storage adapters.
     * Override this for production wiring or testing with mock adapters.
     */
    adapterFactory: AdapterFactory;
}

/**
 * Logger port interface for structured logging.
 *
 * Implementations are provided by entrypoints (MCP server, CLI).
 * Core code and handlers reference only this interface — no OTel imports in core.
 *
 * @example
 * ```typescript
 * // Guard against missing logger in tests
 * ctx.logger?.info('Processing request', { store });
 * ```
 */
export interface Logger {
    /**
     * Log a debug-level message.
     *
     * Use for verbose, developer-facing details such as internal state transitions,
     * resolved paths, or timing information. Typically suppressed in production.
     *
     * @param msg - Diagnostic message
     * @param meta - Optional structured key-value pairs merged into the log entry
     */
    debug(msg: string, meta?: Record<string, unknown>): void;

    /**
     * Log an info-level message.
     *
     * Use for normal operational events that confirm the system is working as
     * expected — e.g., "server started", "memory added", "store resolved".
     *
     * @param msg - Informational message
     * @param meta - Optional structured key-value pairs merged into the log entry
     */
    info(msg: string, meta?: Record<string, unknown>): void;

    /**
     * Log a warning-level message.
     *
     * Use for recoverable conditions that are unexpected or potentially problematic
     * but do not prevent the operation from completing — e.g., deprecated config,
     * missing optional files, retried operations.
     *
     * @param msg - Warning message
     * @param meta - Optional structured key-value pairs merged into the log entry
     */
    warn(msg: string, meta?: Record<string, unknown>): void;

    /**
     * Log an error-level message with optional error details.
     *
     * Use when an operation fails and the failure should be surfaced to operators.
     * Pass the original `Error` object as `err` so implementations can extract
     * the stack trace and error type for structured log sinks or OTel span recording.
     *
     * @param msg - Human-readable description of what failed
     * @param err - Optional `Error` instance or arbitrary thrown value for stack capture
     * @param meta - Optional structured key-value pairs merged into the log entry
     */
    error(msg: string, err?: Error | unknown, meta?: Record<string, unknown>): void;
}

/**
 * Context object for dependency injection into handlers.
 *
 * Provides access to the Cortex client for store operations.
 * Handlers receive this as their first parameter for consistent
 * dependency injection across CLI and MCP server.
 *
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
    /** Live configuration adapter — always reflects current on-disk state */
    config: ConfigAdapter;
    /** Active runtime settings (output format, default store, etc.) */
    settings: CortexSettings;
    /** Map of store names to their configuration, sourced from the config file */
    stores: ConfigStores;

    /** Returns the current timestamp; injectable for deterministic testing */
    now: () => Date;
    /** Process stdin stream — provided for handlers that read interactive input */
    stdin: NodeJS.ReadStream;
    /** Process stdout stream — provided for handlers that write command output */
    stdout: NodeJS.WriteStream;
    /** Current working directory; used to resolve the local `.cortex` store path */
    cwd?: string;
    /** Override for the global data directory; defaults to `~/.config/cortex` */
    globalDataPath?: string;
    /** Optional structured logger. Guard calls with ctx.logger?.info(...) when logger may be absent. */
    logger?: Logger;
}

export type NonEmptyString<T extends string> = T extends '' ? never : T;
