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
import { throwCoreError } from '../../errors.ts';
import { getDefaultConfigPath as getDefaultConfigPath } from '../../context.ts';
import { initializeStore } from '@yeseh/cortex-core/store';
import { type CortexContext } from '@yeseh/cortex-core';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { serializeOutput, type OutputStoreInit, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Explicit store name (otherwise auto-detected from git) */
    name?: string;
    /** Output format (yaml, json, toon) */
    format?: string;
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
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
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
    const configPath = getDefaultConfigPath();

    const storeName = await resolveStoreName(cwd, options.name);
    const rootPath = targetPath 
        ? resolveUserPath(targetPath.trim(), cwd) 
        : resolve(cwd, '.cortex');

    const clientResult = ctx.cortex.getStore(storeName);
    if (!clientResult.ok()) {
        throwCoreError(clientResult.error);
    }

    const store = clientResult.value;
    const createResult = await store.save(rootPath);

    const 



    // 3. Use initializeStore to handle directory creation, index, and registration
    const registry = new FilesystemRegistry(configPath);
    const result = await initializeStore(registry, storeName, rootPath);
    if (!result.ok()) {
        // Map InitStoreError to CLI error
        const errorCode =
            result.error.code === 'STORE_ALREADY_EXISTS'
                ? 'STORE_ALREADY_EXISTS'
                : result.error.code === 'INVALID_STORE_NAME'
                    ? 'INVALID_STORE_NAME'
                    : 'STORE_INIT_FAILED';
        throwCoreError({ code: errorCode, message: result.error.message });
    }

    // 4. Output result
    const output: OutputStoreInit = { path: rootPath, name: storeName };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, deps.stdout ?? process.stdout);
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
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (path, options) => {
        await handleInit(path, options);
    });
