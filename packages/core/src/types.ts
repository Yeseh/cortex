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
 *     adapterFactory: createDefaultAdapterFactory(),
 * };
 *
 * // Full options
 * const testOptions: CortexOptions = {
 *     settings: { outputFormat: 'json' },
 *     stores: {
 *         'test-store': {
 *             kind: 'filesystem',
 *             categories: {},
 *             properties: { path: '/data/test-store' },
 *     },
 *     adapterFactory: createAdapterFactory(),
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
 */
export interface CortexContext {
    /** The root Cortex client instance */
    cortex: Cortex;
    /** Live configuration adapter — always reflects current on-disk state */
    config: ConfigAdapter;
    settings: CortexSettings;
    stores: ConfigStores;

    now: () => Date;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
    cwd?: string;
    globalDataPath?: string;
}

export type NonEmptyString<T extends string> = T extends '' ? never : T;
