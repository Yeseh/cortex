/**
 * Init command for initializing the global cortex configuration store.
 *
 * Creates the global config store at ~/.config/cortex/ with:
 * - config.yaml: Global configuration with default settings
 * - stores.yaml: Store registry with a 'global' store pointing to the memory directory
 * - memory/: Default store with 'global' and 'projects' categories
 *
 * @example
 * ```bash
 * # Initialize global cortex configuration
 * cortex init
 *
 * # Reinitialize even if already initialized
 * cortex init --force
 * ```
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { throwCliError as throwCliError } from '../errors.ts';
import {
    serializeOutput,
    type OutputFormat,
    type OutputInit,
    type OutputPayload,
} from '../output.ts';
import { defaultGlobalStoreCategories } from '@yeseh/cortex-core/category';
import {
    configCategoriesToStoreCategories,
    getDefaultSettings,
    type CortexConfig,
    type CortexContext,
    type StoreData,
} from '@yeseh/cortex-core';
import { createCliCommandContext } from '../create-cli-command.ts';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Reinitialize even if already initialized */
    force?: boolean;
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * The `init` command for initializing the global cortex configuration.
 *
 * Creates the global config store at ~/.config/cortex/ with default settings
 * and store registry.
 *
 * @example
 * ```bash
 * cortex init              # Initialize global config
 * cortex init --force      # Reinitialize even if exists
 * ```
 */
export const initCommand = new Command('init')
    .description('Initialize global cortex configuration')
    .option('-F, --force', 'Reinitialize even if already initialized')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (options) => {
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError({
                code: 'CONTEXT_CREATION_FAILED',
                message: `Failed to create command context: ${context.error.message}`,
            });
        }
        await handleInit(context.value, options);
    });

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Initializes the global cortex config store
 * 2. Creates default categories
 * 3. Outputs the result
 *
 * @param options - Command options (force, format)
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When initialization fails
 */

// TODO: We should move this logic into the core package as a helper function, and just call it from the CLI command handler.
//       Use the ConfigAdapter to initialize the config store and write the default config, instead of manually writing files here. This way we can reuse the same initialization logic in other contexts (e.g. programmatic setup, tests).
export async function handleInit(
    ctx: CortexContext,
    options: InitCommandOptions = {},
): Promise<void> {
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');

    await initializeConfigAdapter(ctx);
    await ensureNotInitialized(ctx, globalStorePath, options.force);
    await createGlobalStore(ctx, globalStorePath);

    // Build output
    const output: OutputPayload = {
        kind: 'init',
        value: formatInit(globalStorePath, Object.keys(defaultGlobalStoreCategories)),
    };

    // Output result
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const outputSerialized = serializeOrThrow(output, format);

    const out = ctx.stdout ?? process.stdout;
    out.write(outputSerialized.value + '\n');
}

const ensureNotInitialized = async (
    ctx: CortexContext,
    globalStorePath: string,
    force = false,
): Promise<void> => {
    if (force) {
        return;
    }

    const existingStoreResult = await ctx.config.getStore('global');
    if (!existingStoreResult.ok()) {
        throwCliError(existingStoreResult.error);
    }

    if (!existingStoreResult.value) {
        return;
    }

    throwCliError({
        code: 'ALREADY_INITIALIZED',
        message: `Global config store already exists at ${globalStorePath}. Use --force to reinitialize.`,
    });
};

const initializeConfigAdapter = async (ctx: CortexContext): Promise<void> => {
    const config: CortexConfig = {
        settings: getDefaultSettings(),
        stores: {},
    };

    const initConfigResult = await ctx.config.initializeConfig(config);
    if (!initConfigResult.ok()) {
        throwCliError(initConfigResult.error);
    }
};

const serializeOrThrow = <T>(value: T, format: OutputFormat) => {
    const serialized = serializeOutput(value, format);
    if (!serialized.ok()) {
        throwCliError(serialized.error);
    }
    return serialized;
};

const createGlobalStore = async (ctx: CortexContext, globalStorePath: string): Promise<void> => {
    const existingStoreResult = await ctx.config.getStore('global');
    if (!existingStoreResult.ok()) {
        throwCliError(existingStoreResult.error);
    }

    if (existingStoreResult.value) {
        return;
    }

    const templateCategories = configCategoriesToStoreCategories(
        defaultGlobalStoreCategories,
    ).unwrap(); // defaultGlobalStoreCategories is valid, unwrap is safe here

    const globalStoreData: StoreData = {
        kind: 'filesystem',
        categoryMode: 'free',
        description:
            'Global memory store for Cortex. Use for cross-project memories and configurations.',
        categories: templateCategories,
        properties: {
            path: globalStorePath,
        },
    };

    const saveStoreResult = await ctx.config.saveStore('global', globalStoreData);
    if (!saveStoreResult.ok()) {
        throwCliError(saveStoreResult.error);
    }
};

const formatInit = (path: string, categories: readonly string[]): OutputInit => ({
    path,
    categories: [...categories],
});

