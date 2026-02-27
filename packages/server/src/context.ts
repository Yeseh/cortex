import {
    Cortex,
    err,
    getDefaultSettings,
    ok,
    type ConfigAdapter,
    type ConfigValidationError,
    type CortexConfig,
    type CortexContext,
    type Result,
} from '@yeseh/cortex-core';
import { homedir } from 'os';
import { isAbsolute, resolve } from 'path';
import { FilesystemConfigAdapter, FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import { stdin, stdout } from 'process';
import type { ServerConfig } from './config';
import { exists, mkdir } from 'fs/promises';

// TODO: Much of this module should move to the FS adapter, since it's all about loading config from the filesystem. The CLI command handlers should just call into the core module to load config and create a context, rather than having all the logic here.

const makeAbsolute = (pathStr: string): string => {
    if (pathStr.startsWith('~')) {
        return resolve(homedir(), pathStr.slice(1).replace(/^[/\\]/, ''));
    }
    return isAbsolute(pathStr) ? pathStr : resolve(pathStr);
};

export const validateStorePath = (
    storePath: string,
    storeName: string
): Result<void, ConfigValidationError> => {
    if (!isAbsolute(storePath)) {
        return err({
            code: 'INVALID_STORE_PATH',
            message:
                `Store '${storeName}' path must be absolute. Got: ${storePath}. ` +
                "Use an absolute path like '/home/user/.cortex/memory'.",
            store: storeName,
        });
    }
    return ok(undefined);
};

export interface ConfigLoadOptions {
    cwd?: string;
    globalConfigPath?: string;
    localConfigPath?: string;
}

const createAdapterFactory = (configAdapter: ConfigAdapter) => {
    // TODO: This should return results
    return (storeName: string) => {
        const stores = configAdapter.stores;
        const store = stores ? stores[storeName] : null;
        if (!store) {
            throw new Error(`Store '${storeName}' not found in configuration.`);
        }

        switch (store.kind) {
            case 'filesystem': {
                const path = store.properties.path as string;
                return new FilesystemStorageAdapter(configAdapter, {
                    rootDirectory: path,
                });
            }
            default:
                throw new Error(`Unsupported store kind '${store.kind}' for store '${storeName}'.`);
        }
    };
};

/* Creates a CortexContext from the environment, including loading configuration and setting up dependencies.
 * This function is used to create a context object that can be injected into command handlers for consistent access to the Cortex client and other utilities.
 * The MCP server is self-initializing, so it also uses this function to create a context for its handlers.
 */
export const createCortexContext = async (
    options: ServerConfig
): Promise<Result<CortexContext, any>> => {
    try {
        const dir = options.dataPath ?? resolve(homedir(), '.config', 'cortex');
        const absoluteDir = makeAbsolute(dir);
        const configPath = resolve(absoluteDir, 'config.yaml');
        const storesDir = resolve(absoluteDir, 'stores');

        const configPathExists = await exists(configPath);
        const configAdapter = new FilesystemConfigAdapter(configPath);

        if (!configPathExists) {
            const defaultSettings = getDefaultSettings();
            const config: CortexConfig = {
                settings: {
                    outputFormat: options.outputFormat ?? defaultSettings.outputFormat,
                    defaultStore: options.defaultStore ?? defaultSettings.defaultStore,
                },
                stores: {
                    // TODO: Allow configuring additional stores and categories for MCP servers.
                    // For now we just create a default store with a free category mode
                    default: {
                        kind: 'filesystem',
                        categoryMode: 'free',
                        categories: {}, // TODO: category templates for MCP servers. ENV does not make sense
                        properties: {
                            path: resolve(storesDir, 'default'),
                        },
                    },
                },
            };

            // If config doesn't exist, we will create a default one. But we still need to initialize the adapter to set its internal state.
            const initResult = await configAdapter.initializeConfig(config);
            if (!initResult.ok()) {
                return err({
                    code: 'CONFIG_INIT_FAILED',
                    message: `Failed to initialize configuration at ${configPath}.`,
                });
            }

            // Create the default store directory on disk so it's ready to use.
            await mkdir(resolve(storesDir, 'default'), { recursive: true });
        } else {
            const reloadResult = await configAdapter.reload();
            if (!reloadResult.ok()) {
                return err({
                    code: 'CONFIG_READ_FAILED',
                    message: `Failed to read configuration at ${configPath}: ${reloadResult.error.message}`,
                });
            }
        }
        const config = configAdapter.data!;
        const adapterFactory = createAdapterFactory(configAdapter);
        const cortex = Cortex.init({
            settings: config.settings,
            stores: config.stores,
            adapterFactory: adapterFactory,
        });

        const now = () => new Date();

        const context: CortexContext = {
            config: configAdapter,
            settings: config.settings ?? getDefaultSettings(),
            stores: config.stores ?? {},
            cortex,
            now,
            stdin,
            stdout,
            globalDataPath: storesDir,
        };

        return ok(context);
    } catch (error) {
        return err({
            code: 'CONTEXT_CREATION_FAILED',
            message: `Unexpected error creating Cortex context: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
