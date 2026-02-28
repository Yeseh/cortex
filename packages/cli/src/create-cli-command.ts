import {
    Cortex,
    err,
    getDefaultSettings,
    ok,
    type ConfigValidationError,
    type CortexContext,
    type Result,
} from '@yeseh/cortex-core';
import { homedir } from 'os';
import { isAbsolute, resolve } from 'path';
import { FilesystemStorageAdapter, FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';
import { stdin, stdout } from 'process';
import { createCliLogger } from './observability.ts';

// TODO: Much of this module should move to the FS adapter, since it's all about loading config from the filesystem. The CLI command handlers should just call into the core module to load config and create a context, rather than having all the logic here.

const makeAbsolute = (pathStr: string): string => {
    if (pathStr.startsWith('~')) {
        return resolve(homedir(), pathStr.slice(1).replace(/^[/\\]/, ''));
    }
    return isAbsolute(pathStr) ? pathStr : resolve(pathStr);
};

export const validateStorePath = (
    storePath: string,
    storeName: string,
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

export interface CliContextOptions {
    configDir?: string;
    configCwd?: string;
}

export interface CliConfigContext {
    configAdapter: FilesystemConfigAdapter;
    stores: Record<string, any>;
    settings: ReturnType<typeof getDefaultSettings>;
    effectiveCwd: string;
}

export const createCliConfigAdapter = (configPath: string): FilesystemConfigAdapter => {
    return new FilesystemConfigAdapter(configPath);
};

export const createCliAdapterFactory = (configAdapter: FilesystemConfigAdapter) => {
    return (storeName: string) => {
        const stores = configAdapter.stores!;
        const storeEntry = stores[storeName];
        if (!storeEntry) {
            throw new Error(
                `Store '${storeName}' not found. Available stores: ${Object.keys(stores).join(', ')}`,
            );
        }

        const storePath = storeEntry.properties?.path as string | undefined;
        if (!storePath) {
            throw new Error(`Store '${storeName}' has no path configured in properties.`);
        }

        return new FilesystemStorageAdapter(configAdapter, {
            rootDirectory: storePath,
        });
    };
};

export const createCliConfigContext = async (
    options: CliContextOptions = {},
): Promise<Result<CliConfigContext, any>> => {
    const envConfigPath = process.env.CORTEX_CONFIG;
    const envConfigDir = process.env.CORTEX_CONFIG_DIR;

    const explicitConfigPath =
        typeof envConfigPath === 'string' && envConfigPath.length > 0
            ? makeAbsolute(envConfigPath)
            : undefined;

    const dir = options.configDir ?? envConfigDir ?? resolve(homedir(), '.config', 'cortex');
    const absoluteDir = makeAbsolute(dir);
    const configPath = explicitConfigPath ?? resolve(absoluteDir, 'config.yaml');

    const envConfigCwd = process.env.CORTEX_CONFIG_CWD;
    const effectiveCwd =
        options.configCwd ??
        (typeof envConfigCwd === 'string' && envConfigCwd.length > 0
            ? envConfigCwd
            : process.cwd());

    const configAdapter = createCliConfigAdapter(configPath);
    const initResult = await configAdapter.initializeConfig();
    if (!initResult.ok()) {
        return initResult;
    }

    const settingsResult = await configAdapter.getSettings();
    if (!settingsResult.ok()) {
        return settingsResult;
    }

    const storesResult = await configAdapter.getStores();
    if (!storesResult.ok()) {
        return storesResult;
    }

    return ok({
        configAdapter,
        settings: settingsResult.value,
        stores: storesResult.value,
        effectiveCwd,
    });
};

/* Creates a CortexContext from the CLI environment, including loading configuration and setting up dependencies.
 * This function is used to create a context object that can be injected into command handlers for consistent access to the Cortex client and other utilities.
 */
export const createCliCommandContext = async (
    configDir?: string,
): Promise<Result<CortexContext, any>> => {
    try {
        const configContextResult = await createCliConfigContext({
            configDir,
        });
        if (!configContextResult.ok()) {
            return configContextResult;
        }

        const { configAdapter, settings, stores } = configContextResult.value;
        const adapterFactory = createCliAdapterFactory(configAdapter);

        const now = () => new Date();
        const cortex = Cortex.init({
            settings,
            stores,
            adapterFactory,
        });

        const logger = createCliLogger();

        const context: CortexContext = {
            config: configAdapter,
            settings: settings ?? getDefaultSettings(),
            stores: stores ?? {},
            cortex,
            now,
            stdin,
            stdout,
            logger,
        };

        return ok(context);
    }
    catch (error) {
        return err({
            code: 'CONTEXT_CREATION_FAILED',
            message: `Unexpected error creating CLI command context: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
