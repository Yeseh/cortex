/**
 * Filesystem implementation of the ConfigAdapter interface.
 *
 * Provides file-based storage for Cortex configuration using YAML format.
 * The configuration file is stored at a user-specified path, typically
 * `~/.config/cortex/config.yaml` for global configuration.
 *
 * This is a top-level adapter that handles the global config file directly,
 * not composed into StorageAdapter like memory/index/category storage.
 *
 * @module storage-fs/config-storage
 *
 * @example
 * ```typescript
 * import { FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';
 * import { homedir } from 'node:os';
 * import { join } from 'node:path';
 *
 * const configPath = join(homedir(), '.config', 'cortex', 'config.yaml');
 * const adapter = new FilesystemConfigAdapter(configPath);
 *
 * // Initialize (creates default config if not exists)
 * await adapter.initialize();
 *
 * // Read settings
 * const settingsResult = await adapter.getSettings();
 * if (settingsResult.ok()) {
 *     console.log('Default store:', settingsResult.value.defaultStore);
 * }
 *
 * // Get all stores
 * const storesResult = await adapter.getStores();
 * if (storesResult.ok()) {
 *     for (const [name, store] of Object.entries(storesResult.value)) {
 *         console.log(`Store: ${name}, Kind: ${store.kind}`);
 *     }
 * }
 * ```
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ok, err, type Result } from '@yeseh/cortex-core';
import type { ConfigAdapter } from '@yeseh/cortex-core/storage';
import type {
    ConfigError,
    ConfigResult,
    ConfigStore,
    ConfigStores,
    CortexSettings,
} from '@yeseh/cortex-core';

/**
 * Internal structure of the parsed config file.
 */
type ParsedConfig = {
    settings?: CortexSettings;
    stores?: ConfigStores;
};

/**
 * Default configuration created when initializing a new config file.
 */
const DEFAULT_CONFIG: ParsedConfig = {
    settings: {},
    stores: {},
};

/**
 * Filesystem-based implementation of the ConfigAdapter interface.
 *
 * Handles reading and initializing the Cortex configuration file stored
 * as YAML. Provides access to global settings and store configurations.
 *
 * @example
 * ```typescript
 * const adapter = new FilesystemConfigAdapter('/home/user/.config/cortex/config.yaml');
 *
 * // Initialize creates the file if it doesn't exist
 * const initResult = await adapter.initialize();
 * if (!initResult.ok()) {
 *     console.error('Failed to initialize config:', initResult.error.message);
 * }
 *
 * // Get a specific store configuration
 * const storeResult = await adapter.getStore('default');
 * if (storeResult.ok() && storeResult.value) {
 *     console.log('Store kind:', storeResult.value.kind);
 * }
 * ```
 */
export class FilesystemConfigAdapter implements ConfigAdapter {
    /**
     * Creates a new FilesystemConfigAdapter instance.
     *
     * @param configPath - Absolute path to the config.yaml file
     *
     * @example
     * ```typescript
     * import { homedir } from 'node:os';
     * import { join } from 'node:path';
     *
     * const configPath = join(homedir(), '.config', 'cortex', 'config.yaml');
     * const adapter = new FilesystemConfigAdapter(configPath);
     * ```
     */
    constructor(private readonly configPath: string) {}

    /**
     * Initializes the configuration file.
     *
     * If the config file already exists, this is a no-op and returns success.
     * If the config file does not exist, creates it with default empty
     * settings and stores. Creates parent directories as needed.
     *
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const result = await adapter.initialize();
     * if (result.ok()) {
     *     console.log('Config initialized successfully');
     * } else {
     *     console.error('Failed to initialize:', result.error.message);
     * }
     * ```
     */
    async initialize(): Promise<ConfigResult<void>> {
        // Check if file already exists
        try {
            await readFile(this.configPath, 'utf-8');
            // File exists, nothing to do
            return ok(undefined);
        }
        catch (error) {
            // File doesn't exist or can't be read, proceed to create
            if (
                error instanceof Error &&
                'code' in error &&
                error.code !== 'ENOENT'
            ) {
                // Some other error (permissions, etc.)
                return err({
                    code: 'CONFIG_READ_FAILED',
                    message: `Failed to check config file: ${error.message}`,
                    path: this.configPath,
                    cause: error,
                });
            }
        }

        // Create parent directories
        try {
            await mkdir(dirname(this.configPath), { recursive: true });
        }
        catch (error) {
            return err({
                // TODO: Change to CONFIG_WRITE_FAILED when error code is added
                code: 'CONFIG_READ_FAILED',
                message: `Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`,
                path: dirname(this.configPath),
                cause: error instanceof Error ? error : undefined,
            });
        }

        // Write default config
        try {
            const content = Bun.YAML.stringify(DEFAULT_CONFIG, null, 2);
            await writeFile(this.configPath, content, 'utf-8');
            return ok(undefined);
        }
        catch (error) {
            return err({
                // TODO: Change to CONFIG_WRITE_FAILED when error code is added
                code: 'CONFIG_READ_FAILED',
                message: `Failed to write config file: ${error instanceof Error ? error.message : String(error)}`,
                path: this.configPath,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    /**
     * Retrieves the Cortex settings from the configuration file.
     *
     * Returns default empty settings if the settings section is missing
     * from the config file.
     *
     * @returns Result containing the settings or an error
     *
     * @example
     * ```typescript
     * const result = await adapter.getSettings();
     * if (result.ok()) {
     *     const { defaultStore, outputFormat } = result.value;
     *     console.log('Default store:', defaultStore ?? 'not set');
     *     console.log('Output format:', outputFormat ?? 'not set');
     * }
     * ```
     */
    async getSettings(): Promise<ConfigResult<CortexSettings>> {
        const configResult = await this._readConfig();
        if (!configResult.ok()) {
            return err(configResult.error);
        }

        return ok(configResult.value.settings ?? {});
    }

    /**
     * Retrieves all store configurations from the configuration file.
     *
     * Returns an empty object if the stores section is missing
     * from the config file.
     *
     * @returns Result containing the stores record or an error
     *
     * @example
     * ```typescript
     * const result = await adapter.getStores();
     * if (result.ok()) {
     *     for (const [name, store] of Object.entries(result.value)) {
     *         console.log(`${name}: ${store.kind} - ${store.description ?? 'no description'}`);
     *     }
     * }
     * ```
     */
    async getStores(): Promise<ConfigResult<ConfigStores>> {
        const configResult = await this._readConfig();
        if (!configResult.ok()) {
            return err(configResult.error);
        }

        return ok(configResult.value.stores ?? {});
    }

    /**
     * Retrieves the configuration for a specific store by name.
     *
     * Returns null if the store is not found in the configuration.
     *
     * @param storeName - The name of the store to retrieve
     * @returns Result containing the store config, null if not found, or an error
     *
     * @example
     * ```typescript
     * const result = await adapter.getStore('default');
     * if (result.ok()) {
     *     if (result.value !== null) {
     *         console.log('Found store:', result.value.kind);
     *     } else {
     *         console.log('Store not found');
     *     }
     * } else {
     *     console.error('Error:', result.error.message);
     * }
     * ```
     */
    async getStore(storeName: string): Promise<ConfigResult<ConfigStore | null>> {
        const configResult = await this._readConfig();
        if (!configResult.ok()) {
            return err(configResult.error);
        }

        const stores = configResult.value.stores ?? {};
        const store = stores[storeName];

        return ok(store ?? null);
    }

    /**
     * Reads and parses the configuration file.
     *
     * This is a private helper method that handles the common logic of
     * reading the config file and parsing its YAML content.
     *
     * @returns Result containing the parsed config or an error
     */
    private async _readConfig(): Promise<Result<ParsedConfig, ConfigError>> {
        let content: string;

        try {
            content = await readFile(this.configPath, 'utf-8');
        }
        catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                return err({
                    code: 'CONFIG_NOT_FOUND',
                    message: `Config file not found at ${this.configPath}. Run initialize() first.`,
                    path: this.configPath,
                });
            }

            return err({
                code: 'CONFIG_READ_FAILED',
                message: `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
                path: this.configPath,
                cause: error instanceof Error ? error : undefined,
            });
        }

        try {
            const parsed = Bun.YAML.parse(content) as ParsedConfig | null;
            return ok(parsed ?? {});
        }
        catch (error) {
            return err({
                code: 'CONFIG_PARSE_FAILED',
                message: `Failed to parse config YAML: ${error instanceof Error ? error.message : String(error)}`,
                path: this.configPath,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }
}
