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
