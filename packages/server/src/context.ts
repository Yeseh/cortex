import { Cortex, err, getDefaultSettings, ok, parseConfig, type ConfigValidationError, type CortexConfig, type CortexContext, type Result } from "@yeseh/cortex-core";
import { homedir } from "os"
import { isAbsolute, resolve } from "path"
import { FilesystemStorageAdapter } from "@yeseh/cortex-storage-fs";
import {stdin, stdout} from 'process';
import type { ServerConfig } from "./config";
import { exists, mkdir } from "fs/promises";

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
            message: `Store '${storeName}' path must be absolute. Got: ${storePath}. ` +
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

/* Creates a CortexContext from the environment, including loading configuration and setting up dependencies.
 * This function is used to create a context object that can be injected into command handlers for consistent access to the Cortex client and other utilities.
 * The MCP server is self-initializing, so it also uses this function to create a context for its handlers. 
 */
export const createCortexContext = async (options: ServerConfig): 
Promise<Result<CortexContext, any>> => {
    try {
        const dir = options.dataPath ?? resolve(homedir(), '.config', 'cortex');
        const absoluteDir = makeAbsolute(dir);
        const configPath = resolve(absoluteDir, 'config.yaml');

        const dataPathExists = await exists(absoluteDir); 
        const configPathExists = await exists(configPath);

        if (!dataPathExists) {
            await mkdir(absoluteDir, { recursive: true });
        }

        let config: CortexConfig;
        if (!configPathExists) {
            const defaultSettings = getDefaultSettings();
            const defaultStorePath = resolve(absoluteDir, 'stores', 'default');

            await mkdir(defaultStorePath, { recursive: true });

            config = {
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
                            path: defaultStorePath 
                        },
                    }
                },
            };

            await Bun.write(configPath, Bun.YAML.stringify(config, null, 2));
        }
        else {
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
            }
            catch (error) {
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

            config = parseResult.value;
        }

        const adapterFactory = (storepath: string) => {
            return new FilesystemStorageAdapter({
                rootDirectory: storepath
            });
        }

        const cortex = Cortex.init({
            settings: config.settings,
            stores: config.stores,
            adapterFactory: adapterFactory
        });

        const now = () => new Date();

        const context: CortexContext = {
            settings: config.settings ?? getDefaultSettings(),
            stores: config.stores ?? {},
            cortex,
            now,
            stdin,
            stdout,
        };

        return ok(context);
    }
    catch (error) {
        throw new Error(`Unexpected error creating Cortex context: ${error instanceof Error ? error.message : String(error)}`);
    }
}