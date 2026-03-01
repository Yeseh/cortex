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
import { throwCliError } from '../errors.ts';
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
import { createCliCommandContext } from '../context.ts';
import { isTTY, defaultPromptDeps, type PromptDeps } from '../utils/prompts.ts';

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
 * Prompts the user to confirm or change the resolved global store path and name.
 *
 * Returns `resolved` unchanged when stdin is not a TTY.
 *
 * @param ctx - Cortex context used for TTY detection via `ctx.stdin`
 * @param resolved - Default store name and path to present as suggestions
 * @param promptDeps - Injectable prompt functions for testability
 * @returns Finalized store name and path (either from prompts or from `resolved`)
 */

/**
 * Resolve a user-supplied path:
 * - expands a leading '~' to the user's home directory
 * - resolves relative paths to an absolute path
 */
function resolveUserPath(userPath: string): string {
    if (!userPath) return userPath;

    let expanded = userPath;
    if (userPath.startsWith('~')) {
        expanded = resolve(homedir(), userPath.slice(1));
    }

    return resolve(expanded);
}

function normalizeStoreName(input: string, fallback: string): string {
    const trimmed = input.trim();
    if (!trimmed) return fallback;

    const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '');

    return slug || fallback;
}

function normalizeStorePath(input: string, fallback: string): string {
    const trimmed = input.trim();
    const base = trimmed || fallback;
    return resolveUserPath(base);
}

async function promptInitOptions(
    ctx: CortexContext,
    resolved: { storeName: string; storePath: string },
    promptDeps: PromptDeps,
): Promise<{ storeName: string; storePath: string }> {
    if (!isTTY(ctx.stdin)) {
        return {
            storeName: normalizeStoreName(resolved.storeName, resolved.storeName),
            storePath: normalizeStorePath(resolved.storePath, resolved.storePath),
        };
    }

    const storePathInput = await promptDeps.input({
        message: 'Global store path:',
        default: resolved.storePath,
    });
    const storeNameInput = await promptDeps.input({
        message: 'Global store name:',
        default: resolved.storeName,
    });

    const storeName = normalizeStoreName(storeNameInput, resolved.storeName);
    const storePath = normalizeStorePath(storePathInput, resolved.storePath);
    return { storePath, storeName };
}

// TODO: We should move this logic into the core package as a helper function, and just call it from the CLI command handler.
//       Use the ConfigAdapter to initialize the config store and write the default config, instead of manually writing files here. This way we can reuse the same initialization logic in other contexts (e.g. programmatic setup, tests).

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. When stdin is a TTY, prompts for global store path and name confirmation
 * 2. Initializes the global cortex config store
 * 3. Creates default categories
 * 4. Outputs the result
 *
 * Interactive mode activates automatically when `ctx.stdin.isTTY === true`.
 * In non-TTY environments (CI, pipes) the defaults are used without prompting.
 *
 * @param ctx - The Cortex context (stdin TTY state used for interactive detection)
 * @param options - Command options (force, format)
 * @param promptDeps - Injectable prompt functions; defaults to real `@inquirer/prompts` functions
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When initialization fails
 *
 * @example
 * ```typescript
 * // Non-interactive (CI / scripts):
 * await handleInit(ctx, { format: 'yaml' });
 *
 * // Force interactive with test stubs:
 * const stubs: PromptDeps = {
 *     input: async ({ default: d }) => d ?? 'test',
 *     confirm: async () => true,
 * };
 * (ctx.stdin as any).isTTY = true;
 * await handleInit(ctx, {}, stubs);
 * ```
 */
export async function handleInit(
    ctx: CortexContext,
    options: InitCommandOptions = {},
    promptDeps: PromptDeps = defaultPromptDeps,
): Promise<void> {
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');

    const resolved = await promptInitOptions(
        ctx,
        { storeName: 'global', storePath: globalStorePath },
        promptDeps,
    );
    const finalStorePath = resolved.storePath;
    const finalStoreName = resolved.storeName;

    await initializeConfigAdapter(ctx);
    await ensureNotInitialized(ctx, finalStoreName, finalStorePath, options.force);
    await createGlobalStore(ctx, finalStoreName, finalStorePath);

    // Build output
    const output: OutputPayload = {
        kind: 'init',
        value: formatInit(finalStorePath, Object.keys(defaultGlobalStoreCategories)),
    };

    // Output result
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const outputSerialized = serializeOrThrow(output, format);

    const out = ctx.stdout ?? process.stdout;
    out.write(outputSerialized.value + '\n');
}

const ensureNotInitialized = async (
    ctx: CortexContext,
    storeName: string,
    globalStorePath: string,
    force = false,
): Promise<void> => {
    if (force) {
        return;
    }

    const existingStoreResult = await ctx.config.getStore(storeName);
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

const serializeOrThrow = <T extends OutputPayload>(value: T, format: OutputFormat) => {
    const serialized = serializeOutput(value, format);
    if (!serialized.ok()) {
        throwCliError(serialized.error);
    }
    return serialized;
};

const createGlobalStore = async (
    ctx: CortexContext,
    storeName: string,
    globalStorePath: string,
): Promise<void> => {
    const existingStoreResult = await ctx.config.getStore(storeName);
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

    const saveStoreResult = await ctx.config.saveStore(storeName, globalStoreData);
    if (!saveStoreResult.ok()) {
        throwCliError(saveStoreResult.error);
    }
};

const formatInit = (path: string, categories: readonly string[]): OutputInit => ({
    path,
    categories: [...categories],
});

