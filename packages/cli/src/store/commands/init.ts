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
import { resolveStoreName } from '../index.ts';
import { throwCliError } from '../../errors.ts';
import { getDefaultConfigPath as getDefaultConfigPath } from '../../context.ts';
import { initializeStore, type StoreData } from '@yeseh/cortex-core/store';
import { type CategoryMode, type CortexContext } from '@yeseh/cortex-core';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';

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
 * Handles the init command execution.
 *
 * This function:
 * 1. Resolves the store name (explicit or git detection)
 * 2. Resolves target path (default to .cortex in cwd)
 * 3. Uses initializeStore to create directory, index, and register
 * 4. Outputs the result
 *
 * @param targetPath - Optional path for the store (defaults to .cortex in cwd)
 * @param options - Command options (name, format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store already exists or init fails
 */
export async function handleInit(
    ctx: CortexContext,
    targetPath: string | undefined,
    options: InitCommandOptions = {},
): Promise<void> {
    const cwd = ctx.cwd ?? process.cwd();
    const stdout = ctx.stdout ?? process.stdout;

    const storeName = await resolveStoreName(cwd, options.name);
    const storePath = targetPath 
        ? resolveUserPath(targetPath.trim(), cwd) 
        : resolve(cwd, '.cortex');

    const clientResult = ctx.cortex.getStore(storeName);
    if (!clientResult.ok()) {
        throwCliError(clientResult.error);
    }

    const storeData: StoreData = {
        kind: 'filesystem',
        categoryMode: options.categoryMode ?? 'free',
        categories: [],
        properties: {
            path: storePath,
        },
        description: options.description,
    };

    const store = clientResult.value;
    const createResult = await store.initialize(storeData);
    if (!createResult.ok()) {
        throwCliError(createResult.error);
    }

    // 4. Output result
    const output: OutputStoreInit = { path: storePath, name: storeName };
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

        await handleInit(context.value, path, options);
    });
