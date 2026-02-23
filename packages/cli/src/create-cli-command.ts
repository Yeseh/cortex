import {
    Cortex,
    err,
    getDefaultSettings,
    ok,
    parseConfig,
    type ConfigValidationError,
    type CortexContext,
    type Result,
} from '@yeseh/cortex-core';
import { homedir } from 'os';
import { isAbsolute, resolve } from 'path';
import { resolve as resolvePath } from 'node:path';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import { stdin, stdout } from 'process';

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

/* Creates a CortexContext from the CLI environment, including loading configuration and setting up dependencies.
 * This function is used to create a context object that can be injected into command handlers for consistent access to the Cortex client and other utilities.
 */
export const createCliCommandContext = async (
    configDir?: string
): Promise<Result<CortexContext, any>> => {
    try {
        // Allow test harnesses / subprocesses to isolate config resolution.
        const envConfigDir = process.env.CORTEX_CONFIG_DIR;
        const dir = configDir ?? envConfigDir ?? resolve(homedir(), '.config', 'cortex');
        const absoluteDir = makeAbsolute(dir);
        const configPath = resolve(absoluteDir, 'config.yaml');
        const configFileCwd = process.env.CORTEX_CONFIG_CWD;
        const effectiveCwd =
            typeof configFileCwd === 'string' && configFileCwd.length > 0
                ? configFileCwd
                : process.cwd();

        // Read config file using Bun.file()
        const configFile = Bun.file(configPath);
        let contents: string;
        try {
            if (!(await configFile.exists())) {
                return err({
                    code: 'CONFIG_NOT_FOUND',
                    message: `Config file not found at ${configPath}. Run 'cortex init' to create one.`,
                    path: configPath,
                });
            }
            contents = await configFile.text();
        } catch (error) {
            return err({
                code: 'CONFIG_READ_FAILED',
                message: `Failed to read config file at ${configPath}.`,
                path: configPath,
                cause: error,
            });
        }

        // Parse and validate config file
        const parseResult = parseConfig(contents);
        if (!parseResult.ok()) {
            return parseResult;
        }

        const adapterFactory = (storeName: string) => {
            // Look up the store's configured path from parsed config
            const storeEntry = config.stores?.[storeName];
            if (!storeEntry) {
                throw new Error(
                    `Store '${storeName}' is not configured. Available stores: ${Object.keys(config.stores ?? {}).join(', ')}`
                );
            }
            const storePath = storeEntry.properties?.path as string | undefined;
            if (!storePath) {
                throw new Error(`Store '${storeName}' has no path configured in properties.`);
            }
            // Interpret relative store paths relative to the invoking CLI's cwd.
            // This matches user expectation and allows isolated subprocess tests.
            const absoluteStorePath = makeAbsolute(resolvePath(effectiveCwd, storePath));
            return new FilesystemStorageAdapter({
                rootDirectory: absoluteStorePath,
            });
        };

        const now = () => new Date();
        const config = parseResult.value;
        const cortex = Cortex.init({
            settings: config.settings,
            stores: config.stores,
            adapterFactory: adapterFactory,
        });

        const context: CortexContext = {
            settings: config.settings ?? getDefaultSettings(),
            stores: config.stores ?? {},
            cortex,
            now,
            stdin,
            stdout,
        };

        return ok(context);
    } catch (error) {
        throw new Error(
            `Unexpected error creating CLI command context: ${error instanceof Error ? error.message : String(error)}`
        );
    }
};
