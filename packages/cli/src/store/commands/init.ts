/**
 * Store init command for initializing a new memory store.
 *
 * This command creates a new memory store at the specified path (or current
 * directory) and registers it in the global registry. The store name is
 * either explicitly provided via --name or auto-detected from the git
 * repository name.
 *
 * @example
 * ```bash
 * # Initialize store with auto-detected name from git repo
 * cortex store init
 *
 * # Initialize store with explicit name
 * cortex store init --name my-project
 *
 * # Initialize store at a specific path
 * cortex store init ./my-store --name my-project
 *
 * # Initialize store with tilde expansion
 * cortex store init ~/memories --name personal
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { resolve } from 'node:path';
import { resolveStoreName } from '../utils/resolve-store-name.ts';
import { throwCliError } from '../../errors.ts';
import { type StoreData } from '@yeseh/cortex-core/store';
import { type CategoryMode, type CortexContext } from '@yeseh/cortex-core';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';
import { isTTY, defaultPromptDeps, type PromptDeps } from '../../prompts.ts';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Explicit store name (otherwise auto-detected from git) */
    name?: string;
    /** Category mode for the store */
    categoryMode?: CategoryMode;
    /** Output format (yaml, json, toon) */
    format?: string;
    /** Optional description for the store */
    description?: string;
}

/**
 * Writes the serialized output to the output stream.
 *
 * @param output - The store init output payload
 * @param format - The output format
 * @param stdout - The output stream
 */
function writeOutput(
    output: OutputStoreInit,
    format: OutputFormat,
    stdout: NodeJS.WritableStream,
): void {
    const serialized = serializeOutput({ kind: 'store-init', value: output }, format);
    if (!serialized.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Prompts the user for store name and path when running in an interactive TTY.
 * Skips prompts when stdin is not a TTY, or when values were explicitly provided.
 *
 * @param ctx - The Cortex context (used to detect TTY)
 * @param resolved - The auto-resolved store name and path
 * @param explicit - Which values were explicitly provided by the caller
 * @param promptDeps - The prompt functions to use
 * @returns The final store name and path (prompted or original)
 */
async function promptStoreInitOptions(
    ctx: CortexContext,
    resolved: { storeName: string; storePath: string },
    explicit: { name?: string; path?: string },
    promptDeps: PromptDeps,
): Promise<{ storeName: string; storePath: string }> {
    if (!isTTY(ctx.stdin)) return resolved;

    const storeName = explicit.name
        ? resolved.storeName
        : await promptDeps.input({ message: 'Store name:', default: resolved.storeName });

    const storePath = explicit.path
        ? resolved.storePath
        : await promptDeps.input({ message: 'Store path:', default: resolved.storePath });

    return { storeName, storePath };
}

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Resolves the store name (explicit or git detection)
 * 2. In TTY mode, prompts user to confirm/change store name and path
 * 3. Resolves target path (default to .cortex in cwd)
 * 4. Initializes the store directory and registers it
 * 5. Outputs the result
 *
 * @param ctx - The Cortex context
 * @param targetPath - Optional path for the store (defaults to .cortex in cwd)
 * @param options - Command options (name, format)
 * @param promptDeps - Optional prompt dependencies for testing
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store already exists or init fails
 */
export async function handleInit(
    ctx: CortexContext,
    targetPath: string | undefined,
    options: InitCommandOptions = {},
    promptDeps: PromptDeps = defaultPromptDeps,
): Promise<void> {
    const cwd = ctx.cwd ?? process.cwd();
    const stdout = ctx.stdout ?? process.stdout;

    let storeName: string;
    try {
        storeName = await resolveStoreName(cwd, options.name);
    }
    catch (e) {
        if (isTTY(ctx.stdin)) {
            // Will be resolved via prompt below
            storeName = '';
        }
        else {
            throw e;
        }
    }

    const storePath = targetPath
        ? resolveUserPath(targetPath.trim(), cwd)
        : resolve(cwd, '.cortex');

    const resolved = await promptStoreInitOptions(
        ctx,
        { storeName, storePath },
        { name: options.name, path: targetPath },
        promptDeps,
    );

    const finalStoreName = resolved.storeName;
    const finalStorePath = resolved.storePath;

    if (!finalStoreName) {
        throwCliError({
            code: 'INVALID_STORE_NAME',
            message: 'Store name is required. Use --name to specify one.',
        });
    }

    const clientResult = ctx.cortex.getStore(finalStoreName);
    if (!clientResult.ok()) {
        throwCliError(clientResult.error);
    }

    const storeData: StoreData = {
        kind: 'filesystem',
        categoryMode: (options.categoryMode as CategoryMode) ?? 'free',
        categories: [],
        properties: {
            path: finalStorePath,
        },
        description: options.description,
    };

    const store = clientResult.value;
    const createResult = await store.initialize(storeData);
    if (!createResult.ok()) {
        throwCliError(createResult.error);
    }

    const output: OutputStoreInit = { path: finalStorePath, name: finalStoreName };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, stdout);
}

/**
 * The `init` subcommand for initializing a new memory store.
 *
 * Creates a new store at the specified path (or .cortex in current directory)
 * and registers it in the global registry. The store name is auto-detected
 * from the git repository name or can be explicitly provided.
 *
 * @example
 * ```bash
 * cortex store init                        # Auto-detect name from git
 * cortex store init --name my-project      # Explicit name
 * cortex store init ./store --name custom  # Custom path and name
 * ```
 */
export const initCommand = new Command('init')
    .description('Initialize a new memory store')
    .argument('[path]', 'Path for the store (defaults to .cortex in current directory)')
    .option('-n, --name <name>', 'Explicit store name (otherwise auto-detected from git)')
    .option('-d, --description <description>', 'Optional description for the store')
    .option('-c, --category-mode <mode>', 'Category mode (free, strict, flat)', 'free')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (path, options) => {
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }

        await handleInit(context.value, path, {
            name: options.name,
            description: options.description,
            categoryMode: options.categoryMode as CategoryMode,
            format: options.format,
        });
    });
