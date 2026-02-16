/**
 * Root client for the Cortex memory system.
 *
 * @module core/cortex
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { err, ok, type Result } from '../result.ts';
import {
    type CortexSettings,
    DEFAULT_CORTEX_SETTINGS,
    parseMergedConfig,
    serializeMergedConfig,
} from '../config.ts';
import type { Registry, StoreDefinition } from '../store/registry.ts';
import type {
    ScopedStorageAdapter,
    StoreNotFoundError,
    AdapterFactory,
    CortexOptions,
} from '../storage/adapter.ts';

export type { Registry, StoreDefinition };

export type CortexErrorCode =
    | 'CONFIG_NOT_FOUND'
    | 'CONFIG_READ_FAILED'
    | 'CONFIG_PARSE_FAILED'
    | 'CONFIG_WRITE_FAILED'
    | 'INVALID_STORE_PATH'
    | 'INITIALIZE_FAILED'
    | 'STORE_NOT_FOUND'
    | 'STORE_ALREADY_EXISTS';

export interface CortexError {
    code: CortexErrorCode;
    message: string;
    cause?: unknown;
}

/** Options with all fields required (internal use) */
interface RequiredCortexOptions {
    rootDirectory: string;
    settings: CortexSettings;
    registry: Registry;
    adapterFactory: AdapterFactory;
}

/**
 * Checks if an error is a "file not found" error (ENOENT).
 */
const isNotFoundError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    if (!('code' in error)) return false;
    return (error as { code?: string }).code === 'ENOENT';
};

/**
 * Creates a default adapter factory.
 * Note: This returns a factory that throws at runtime. In production,
 * either pass adapterFactory to fromConfig() or use the factory from storage-fs.
 */
const createDefaultAdapterFactory = (): AdapterFactory => {
    return (storePath: string): ScopedStorageAdapter => {
        // This will be replaced by the actual factory from storage-fs
        // when used in CLI/Server entry points
        throw new Error(
            `No adapter factory provided. Pass adapterFactory to Cortex.fromConfig() or Cortex.init(). Store path: ${storePath}`,
        );
    };
};

/**
 * Root client for the Cortex memory system.
 *
 * Provides unified access to stores, settings, and storage adapters.
 * Use `Cortex.fromConfig()` to load from filesystem or `Cortex.init()`
 * for programmatic creation (e.g., in tests).
 *
 * @example
 * ```typescript
 * // Load from config file
 * const result = await Cortex.fromConfig('~/.config/cortex');
 * if (result.ok()) {
 *     const store = result.value.getStore('default');
 *     // use store...
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Programmatic creation for testing
 * const cortex = Cortex.init({
 *     rootDirectory: '/tmp/test',
 *     registry: { test: { path: '/tmp/store' } },
 * });
 * ```
 */
export class Cortex {
    /** Config directory path */
    readonly rootDirectory: string;
    /** Current settings */
    readonly settings: CortexSettings;
    /** Store definitions */
    private readonly registry: Registry;
    /** Factory for creating adapters */
    private readonly adapterFactory: AdapterFactory;

    private constructor(options: RequiredCortexOptions) {
        this.rootDirectory = options.rootDirectory;
        this.settings = options.settings;
        this.registry = options.registry;
        this.adapterFactory = options.adapterFactory;
    }

    /**
     * Load Cortex from a config directory.
     *
     * Reads config.yaml from the specified directory and initializes
     * the Cortex instance with settings and store definitions.
     *
     * @param configDir - Path to config directory (e.g., ~/.config/cortex)
     * @param defaultAdapterFactory - Optional custom adapter factory
     * @returns Result with Cortex instance or error
     *
     * @example
     * ```typescript
     * const result = await Cortex.fromConfig('~/.config/cortex');
     * if (result.ok()) {
     *     console.log('Settings:', result.value.settings);
     * }
     * ```
     */
    static async fromConfig(
        configDir: string,
        defaultAdapterFactory?: AdapterFactory,
    ): Promise<Result<Cortex, CortexError>> {
        // Expand ~ to home directory
        const resolvedDir = configDir.startsWith('~')
            ? join(
                homedir(),
                configDir.slice(configDir[1] === '/' || configDir[1] === '\\' ? 2 : 1),
            )
            : resolve(configDir);

        const configPath = join(resolvedDir, 'config.yaml');

        let contents: string;
        try {
            contents = await readFile(configPath, 'utf8');
        }
        catch (error) {
            if (isNotFoundError(error)) {
                return err({
                    code: 'CONFIG_NOT_FOUND',
                    message: `Config file not found at ${configPath}. Run 'cortex init' to create one.`,
                });
            }
            return err({
                code: 'CONFIG_READ_FAILED',
                message: `Failed to read config at ${configPath}. Check file permissions and try again.`,
                cause: error,
            });
        }

        const parsed = parseMergedConfig(contents);
        if (!parsed.ok()) {
            return err({
                code: parsed.error.code as CortexErrorCode,
                message: parsed.error.message,
                cause: parsed.error.cause,
            });
        }

        // Use provided factory or lazy-load default from storage-fs
        const adapterFactory = defaultAdapterFactory ?? createDefaultAdapterFactory();

        return ok(
            new Cortex({
                rootDirectory: resolvedDir,
                settings: parsed.value.settings,
                registry: parsed.value.stores,
                adapterFactory,
            }),
        );
    }

    /**
     * Create Cortex programmatically without filesystem access.
     *
     * Useful for testing with mock adapters or programmatic configuration.
     * Does not read from or write to the filesystem.
     *
     * @param options - Configuration options
     * @returns Cortex instance
     *
     * @example
     * ```typescript
     * const cortex = Cortex.init({
     *     rootDirectory: '/tmp/test',
     *     settings: { outputFormat: 'json', autoSummary: false, strictLocal: false },
     *     registry: { test: { path: '/tmp/test/store' } },
     *     adapterFactory: (path) => createMockAdapter(path),
     * });
     * ```
     */
    static init(options: CortexOptions): Cortex {
        return new Cortex({
            rootDirectory: options.rootDirectory,
            settings: { ...DEFAULT_CORTEX_SETTINGS, ...options.settings },
            registry: options.registry ?? {},
            adapterFactory: options.adapterFactory ?? createDefaultAdapterFactory(),
        });
    }

    /**
     * Initialize the config directory structure.
     *
     * Creates the config directory and config.yaml if they don't exist.
     * Idempotent - safe to call multiple times.
     *
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const cortex = Cortex.init({ rootDirectory: '~/.config/cortex' });
     * const result = await cortex.initialize();
     * if (result.ok()) {
     *     console.log('Config initialized');
     * }
     * ```
     */
    async initialize(): Promise<Result<void, CortexError>> {
        try {
            await mkdir(this.rootDirectory, { recursive: true });

            const configPath = join(this.rootDirectory, 'config.yaml');

            // Check if config exists
            try {
                await readFile(configPath, 'utf8');
                // Already exists, nothing to do
                return ok(undefined);
            }
            catch (error) {
                if (!isNotFoundError(error)) {
                    return err({
                        code: 'INITIALIZE_FAILED',
                        message: `Failed to check config at ${configPath}`,
                        cause: error,
                    });
                }
            }

            // Write new config
            const configYaml = serializeMergedConfig({
                settings: this.settings,
                stores: this.registry,
            });

            await writeFile(configPath, configYaml, 'utf8');
            return ok(undefined);
        }
        catch (error) {
            return err({
                code: 'INITIALIZE_FAILED',
                message: `Failed to initialize config directory at ${this.rootDirectory}. Check write permissions and available disk space.`,
                cause: error,
            });
        }
    }

    /**
     * Get a scoped storage adapter for a named store.
     *
     * @param name - Store name from the registry
     * @returns Result with adapter or STORE_NOT_FOUND error
     *
     * @example
     * ```typescript
     * const result = cortex.getStore('default');
     * if (result.ok()) {
     *     const memory = await result.value.memories.read(path);
     * }
     * ```
     */
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
        const definition = this.registry[name];
        if (!definition) {
            const availableStores = Object.keys(this.registry);
            const storeList = availableStores.length > 0 ? availableStores.join(', ') : 'none';
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${name}' is not registered. Available stores: ${storeList}`,
                store: name,
            });
        }

        return ok(this.adapterFactory(definition.path));
    }

    /**
     * Add a store to the registry and persist the change.
     *
     * Updates the in-memory registry and writes the updated config to disk.
     * Returns an error if the store already exists.
     *
     * @param name - Store name (must be unique)
     * @param definition - Store definition with path and optional description
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const result = await cortex.addStore('my-project', {
     *     path: '/path/to/store',
     *     description: 'Project memories'
     * });
     * if (result.ok()) {
     *     console.log('Store added');
     * }
     * ```
     */
    async addStore(name: string, definition: StoreDefinition): Promise<Result<void, CortexError>> {
        // Check for existing store
        if (this.registry[name]) {
            return err({
                code: 'STORE_ALREADY_EXISTS',
                message: `Store '${name}' already exists`,
            });
        }

        // Add to registry (mutate in place - readonly is for external consumers)
        (this.registry as Record<string, StoreDefinition>)[name] = definition;

        // Persist to disk
        return this.saveConfig();
    }

    /**
     * Remove a store from the registry.
     *
     * @param name - Store name to remove
     * @returns Result indicating success or failure
     */
    async removeStore(name: string): Promise<Result<void, CortexError>> {
        if (!this.registry[name]) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${name}' is not registered.`,
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (this.registry as Record<string, StoreDefinition>)[name];
        return this.saveConfig();
    }

    /**
     * Check if a store is registered.
     *
     * @param name - Store name to check
     * @returns true if the store exists
     */
    hasStore(name: string): boolean {
        return name in this.registry;
    }

    /**
     * Get all registered store names.
     *
     * @returns Array of store names
     */
    listStores(): string[] {
        return Object.keys(this.registry);
    }

    /**
     * Get all store definitions.
     *
     * @returns Record of store names to their definitions
     */
    getStoreDefinitions(): Readonly<Record<string, StoreDefinition>> {
        return this.registry;
    }

    /**
     * Persist the current config to disk.
     *
     * @internal
     */
    private async saveConfig(): Promise<Result<void, CortexError>> {
        try {
            const configPath = join(this.rootDirectory, 'config.yaml');
            const configYaml = serializeMergedConfig({
                settings: this.settings,
                stores: this.registry,
            });
            await writeFile(configPath, configYaml, 'utf8');
            return ok(undefined);
        }
        catch (error) {
            return err({
                code: 'CONFIG_WRITE_FAILED',
                message: `Failed to save config at ${this.rootDirectory}. Check write permissions.`,
                cause: error,
            });
        }
    }
}

/**
 * Shared context object passed to CLI and MCP handlers.
 *
 * Provides access to the Cortex root client and I/O streams for
 * consistent handling across all command handlers. The CLI uses
 * {@link createCortexContext} to create this object, while the MCP
 * server wires it at startup.
 *
 * @module core/cortex
 *
 * @example
 * ```typescript
 * // In CLI handler
 * async function handleAdd(ctx: CortexContext, path: string, options: AddOptions) {
 *     const storeResult = ctx.cortex.getStore(storeName);
 *     // ...
 * }
 *
 * // In MCP tool handler
 * async function handleAddMemory(ctx: CortexContext, input: AddMemoryInput) {
 *     const storeResult = ctx.cortex.getStore(input.store);
 *     // ...
 * }
 * ```
 */
export interface CortexContext {
    /** Root Cortex client instance */
    cortex: Cortex;
    /** Output stream for writing results */
    stdout: NodeJS.WritableStream;
    /** Input stream for reading content */
    stdin: NodeJS.ReadableStream;
    /** Current time for expiration checks and timestamps */
    now: Date;
}
