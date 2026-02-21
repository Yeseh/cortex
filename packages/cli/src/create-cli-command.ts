import { Cortex, err, getDefaultSettings, ok, parseConfig, type ConfigValidationError, type CortexContext, type InitializeError, type Registry, type Result } from "@yeseh/cortex-core";
import type { Command } from "commander"
import { homedir } from "os"
import { isAbsolute, resolve } from "path"
import { FilesystemStorageAdapter } from "@yeseh/cortex-storage-fs";
import {stdin, stdout} from 'process';

// TODO: Much of this module should move to the FS adapter, since it's all about loading config from the filesystem. The CLI command handlers should just call into the core module to load config and create a context, rather than having all the logic here. 


type CommandHandler<
    Args extends any[] = any[],
    Opts extends Record<string, unknown> = {}
> = (this: Command, ...args: [...Args, Opts, Command]) => void | Promise<void>

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

/* Creates a CortexContext from the CLI environment, including loading configuration and setting up dependencies.
 * This function is used to create a context object that can be injected into command handlers for consistent access to the Cortex client and other utilities.
 */
export const createCliCommandContext = async (
    configDir?: string
): Promise<Result<CortexContext, any>> => {
    try {
        const dir = configDir ?? resolve(homedir(), '.config', 'cortex');
        const absoluteDir = makeAbsolute(dir);
        const configPath = resolve(absoluteDir, 'config.yaml');

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

        const adapterFactory = async (storepath: string) => {
            return new FilesystemStorageAdapter({
                rootDirectory: storepath
            });
        }

        const config = parseResult.value;
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
        throw new Error(`Unexpected error creating CLI command context: ${error instanceof Error ? error.message : String(error)}`);
    }
}


    /**
     * Creates the folder structure and config file for this Cortex instance.
     *
     * This operation is idempotent - calling it multiple times is safe.
     * If the directory and config already exist, they are preserved.
     *
     * @returns Result indicating success or failure
     *
     * @example
     * ```typescript
     * const cortex = Cortex.init({
     *     rootDirectory: '/path/to/new/config',
     *     registry: { 'default': { path: '/path/to/store' } },
     * });
     *
     * const result = await cortex.initialize();
     * if (result.ok()) {
     *     console.log('Cortex initialized successfully');
     * }
     * ```
    async function initialize(
        rootDirectory: string,
        registry: Registry,
        settings: Partial<CortexSettings>,

    ): Promise<Result<void, InitializeError>> {
        const configPath = resolve(rootDirectory, 'config.yaml');
        const configFile = Bun.file(configPath);

        // Check if config already exists using Bun.file()
        if (await configFile.exists()) {
            // Config exists, preserve it (idempotent)
            return ok(undefined);
        }

        // Create directory structure
        try {
            await mkdir(rootDirectory, { recursive: true }, null);
        }
        catch (error) {
            return err({
                code: 'DIRECTORY_CREATE_FAILED',
                message: `Failed to create directory at ${rootDirectory}. Check that the parent directory exists and you have write permissions.`,
                path: rootDirectory,
                cause: error,
            });
        }

        // Write config file using Bun.write()
        try {
            const configContent = serializeConfig(this.settings, this.registry);
            await Bun.write(configPath, configContent);
        }
        catch (error) {
            return err({
                code: 'CONFIG_WRITE_FAILED',
                message: `Failed to write config file at ${configPath}. Check that you have write permissions to the directory.`,
                path: configPath,
                cause: error,
            });
        }

        return ok(undefined);
    }
     */