/**
 * Cortex module types and interfaces.
 *
 * @module core/cortex/types
 */

import type { StorageAdapter } from '@/storage/index.ts';
import type { Cortex } from './cortex.ts';
import type { CortexSettings, ConfigStores } from '@/config/types.ts';

/**
 * Factory function for creating scoped storage adapters.
 *
 * @param storePath - The filesystem path to the store's root directory
 * @returns A scoped storage adapter for the store
 *
 * @example
 * ```typescript
 * // Default filesystem adapter factory
 * const defaultFactory: AdapterFactory = (storePath) =>
 *     new FilesystemStorageAdapter({ rootDirectory: storePath });
 *
 * // Mock adapter factory for testing
 * const mockFactory: AdapterFactory = (storePath) => ({
 *     memories: mockMemoryStorage,
 *     indexes: mockIndexStorage,
 *     categories: mockCategoryStorage,
 * });
 * ```
 */
export type AdapterFactory = (storePath: string) => StorageAdapter;

/**
 * Options for programmatic Cortex creation via `Cortex.init()`.
 *
 * @module core/cortex/types
 *
 * @example
 * ```typescript
 * // Minimal options (uses defaults)
 * const options: CortexOptions = {
 *     rootDirectory: '/path/to/cortex/config',
 * };
 *
 * // Full options with custom adapter factory for testing
 * const testOptions: CortexOptions = {
 *     rootDirectory: '/tmp/test-cortex',
 *     settings: { outputFormat: 'json' },
 *     registry: {
 *         'test-store': { path: '/tmp/test-store' }
 *     },
 *     adapterFactory: createMockAdapter,
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
     * Default: empty registry `{}`
     */
    registry: ConfigStores;

    /**
     * Custom adapter factory for creating storage adapters.
     * Default: filesystem adapter factory
     *
     * Override this for testing with mock adapters.
     */
    adapterFactory: AdapterFactory;
}



/**
 * Error codes for Cortex initialization operations.
 *
 * @module core/cortex/types
 *
 * - `DIRECTORY_CREATE_FAILED` - Failed to create Cortex directories (permissions, disk full)
 * - `CONFIG_WRITE_FAILED` - Failed to write initial configuration file
 *
 * @example
 * ```typescript
 * function handleInitError(error: InitializeError): void {
 *     switch (error.code) {
 *         case 'DIRECTORY_CREATE_FAILED':
 *             console.log(`Cannot create directory: ${error.path}`);
 *             break;
 *         case 'CONFIG_WRITE_FAILED':
 *             console.log('Check write permissions for config directory');
 *             break;
 *     }
 * }
 * ```
 */
export type InitializeErrorCode = 'DIRECTORY_CREATE_FAILED' | 'CONFIG_WRITE_FAILED';

/**
 * Error returned when initializing Cortex fails.
 *
 * @module core/cortex/types
 *
 * @example
 * ```typescript
 * const error: InitializeError = {
 *     code: 'DIRECTORY_CREATE_FAILED',
 *     message: 'Failed to create config directory: permission denied',
 *     path: '/home/user/.config/cortex',
 *     cause: new Error('EACCES: permission denied'),
 * };
 * ```
 */
export interface InitializeError {
    /** Machine-readable error code */
    code: InitializeErrorCode;
    /** Human-readable error message */
    message: string;
    /** Path involved in the failure */
    path?: string;
    /** Underlying error cause (for debugging) */
    cause?: unknown;
}

/**
 * Context object for dependency injection into handlers.
 *
 * Provides access to the Cortex client for store operations.
 * Handlers receive this as their first parameter for consistent
 * dependency injection across CLI and MCP server.
 *
 * @module core/cortex/types
 *
 * @example
 * ```typescript
 * // CLI handler
 * async function handleAdd(
 *     ctx: CortexContext,
 *     path: string,
 *     options: AddOptions
 * ): Promise<void> {
 *     const store = ctx.cortex.getStore('my-store');
 *     // ...
 * }
 *
 * // MCP tool handler
 * async function addMemoryHandler(
 *     ctx: CortexContext,
 *     input: AddMemoryInput
 * ): Promise<McpToolResponse> {
 *     const store = ctx.cortex.getStore(input.store);
 *     // ...
 * }
 * ```
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
    now: () => Date;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
}
