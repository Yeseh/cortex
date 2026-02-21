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
export type AdapterFactory = (storeName: string) => StorageAdapter;

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
    stores?: ConfigStores | undefined;

    /**
     * Custom adapter factory for creating storage adapters.
     * Default: filesystem adapter factory
     *
     * Override this for testing with mock adapters.
     */
    adapterFactory: AdapterFactory;
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
    settings: CortexSettings;
    stores: ConfigStores;
    now: () => Date;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    cwd?: string;
}


export type NonEmptyString<T extends string> = T extends '' ? never : T;
