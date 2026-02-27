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
import { ok, err, storeCategoriesToConfigCategories, configFileSchema } from '@yeseh/cortex-core';
import type { ConfigAdapter } from '@yeseh/cortex-core/storage';
import type {
    ConfigResult,
    ConfigStore,
    ConfigStores,
    CortexConfig,
    CortexSettings,
    StoreData,
} from '@yeseh/cortex-core';

/**
 * Internal structure of the parsed config file.
 */
type ParsedConfig = {
    settings: CortexSettings;
    stores: ConfigStores;
};

/**
 * Default configuration created when initializing a new config file.
 */
const DEFAULT_CONFIG: ParsedConfig = {
    settings: {
        defaultStore: 'global',
        outputFormat: 'yaml',
    },
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
 * const storeResult = await adapter.getStore('global');
 * if (storeResult.ok() && storeResult.value) {
 *     console.log('Store kind:', storeResult.value.kind);
 * }
 * ```
 */
export class FilesystemConfigAdapter implements ConfigAdapter {
    #config: CortexConfig | null = null;
    readonly path: string;

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
    constructor(private readonly configPath: string) {
        this.path = configPath;
    }

    // Returns the raw config data or null if not loaded
    get data(): CortexConfig | null {
        return this.#config;
    }

    // Returns the settings or null if config not loaded
    get settings(): CortexSettings | null {
        return this.#config?.settings ?? null;
    }

    // Returns the stores record, or null if config not loaded
    get stores(): ConfigStores | null {
        return this.#config?.stores ?? null;
    }

    /**
     * Initializes the configuration file.
     *
     * If the config file already exists, loads the file from storage and returns that
     * If the config file does not exist, creates it with default
     * settings and stores. Creates parent directories as needed.
     *
     * @returns Result indicating success or failure
     * ```
     */
    async initializeConfig(config?: CortexConfig): Promise<ConfigResult<void>> {
        const readResult = await this._readConfig();
        if (readResult.ok()) {
            // Config file already exists, nothing to do
            return ok(undefined);
        } else if (readResult.error.code !== 'CONFIG_NOT_FOUND') {
            return err(readResult.error);
        }

        // Config not found — create parent directory before writing
        try {
            await mkdir(dirname(this.configPath), { recursive: true });
        } catch (error) {
            return err({
                code: 'CONFIG_WRITE_FAILED',
                message: `Failed to create config directory: ${error instanceof Error ? error.message : String(error)}`,
                path: dirname(this.configPath),
                cause: error instanceof Error ? error : undefined,
            });
        }

        const configToWrite = config ?? DEFAULT_CONFIG;
        const writeResult = await this._writeConfig(configToWrite);
        if (!writeResult.ok()) {
            return err(writeResult.error);
        }

        this.#config = configToWrite;

        return ok(undefined);
    }

    async reload(): Promise<ConfigResult<void>> {
        const readResult = await this._readConfig();
        if (!readResult.ok()) {
            return err(readResult.error);
        }

        return ok(undefined);
    }

    async saveStore(storeName: string, data: StoreData): Promise<ConfigResult<void>> {
        if (!data.properties.path) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Store '${storeName}' is missing required 'path' property.`,
                store: storeName,
            });
        }

        if (data.kind !== 'filesystem') {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Store '${storeName}' has unsupported kind '${data.kind}'. Only 'filesystem' is supported by FilesystemConfigAdapter.`,
                store: storeName,
                kind: data.kind,
            });
        }

        const configResult = await this._readConfig();
        if (!configResult.ok()) {
            return err(configResult.error);
        }

        const stores = this.#config?.stores ?? {};

        stores[storeName] = {
            kind: data.kind,
            categoryMode: data.categoryMode,
            description: data.description,
            categories: storeCategoriesToConfigCategories(data.categories),
            properties: {
                path: data.properties.path,
            },
        };

        const updatedConfig: CortexConfig = {
            ...this.#config!,
            stores,
        };

        const writeResult = await this._writeConfig(updatedConfig);
        if (!writeResult.ok()) {
            return err(writeResult.error);
        }

        this.#config = updatedConfig;

        return ok(undefined);
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
        if (!this.#config) {
            const configResult = await this._readConfig();
            if (!configResult.ok()) {
                return err(configResult.error);
            }
        }

        return ok(this.#config?.settings ?? DEFAULT_CONFIG.settings);
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
        if (!this.#config) {
            const configResult = await this._readConfig();
            if (!configResult.ok()) {
                return err(configResult.error);
            }
        }

        return ok(this.#config?.stores ?? DEFAULT_CONFIG.stores);
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
     * const result = await adapter.getStore('global');
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

        const stores = this.#config?.stores ?? DEFAULT_CONFIG.stores;
        const store = stores[storeName];
        if (!store) {
            return ok(null);
        }

        return ok(store);
    }

    private async _writeConfig(config: CortexConfig): Promise<ConfigResult<void>> {
        try {
            const content = Bun.YAML.stringify(config, null, 2);
            await writeFile(this.configPath, content, 'utf-8');
            return ok(undefined);
        } catch (error) {
            return err({
                code: 'CONFIG_WRITE_FAILED',
                message: `Failed to write config file: ${error instanceof Error ? error.message : String(error)}`,
                path: this.configPath,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    /**
     * Reads and parses the configuration file.
     *
     * This is a private helper method that handles the common logic of
     * reading the config file and parsing its YAML content.
     *
     * @returns Result containing the parsed config or an error
     */
    private async _readConfig(): Promise<ConfigResult<void>> {
        let content: string;

        try {
            content = await readFile(this.configPath, 'utf-8');
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
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
            const yaml = Bun.YAML.parse(content) as CortexConfig;
            const parsed = configFileSchema.safeParse(yaml);
            if (!parsed.success) {
                return err({
                    code: 'CONFIG_PARSE_FAILED',
                    message: `Config file validation failed: ${parsed.error.message}`,
                });
            }

            this.#config = parsed.data;
        } catch (error) {
            return err({
                code: 'CONFIG_PARSE_FAILED',
                message: `Failed to parse config YAML: ${error instanceof Error ? error.message : String(error)}`,
                path: this.configPath,
                cause: error instanceof Error ? error : undefined,
            });
        }

        return ok(undefined);
    }
}
