/**
 * Store list command for displaying all registered stores.
 *
 * This command reads the store registry and displays all registered
 * stores sorted alphabetically by name.
 *
 * @example
 * ```bash
 * # List all stores in YAML format (default)
 * cortex store list
 *
 * # List all stores in JSON format
 * cortex store list --format json
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { loadRegistry } from '../../context.ts';
import { serializeOutput, type OutputStoreRegistry, type OutputFormat } from '../../output.ts';

/**
 * Options for the list command.
 */
export interface ListCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Dependencies for the list command handler.
 * Allows injection for testing.
 */
export interface ListHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
}

/**
 * Handles the list command execution.
 *
 * This function:
 * 1. Loads the store registry
 * 2. Formats the stores as a sorted list
 * 3. Serializes and outputs the result
 *
 * @param options - Command options (format)
 * @param deps - Optional dependencies for testing
 * @throws {CommanderError} When the registry cannot be loaded or serialization fails
 */
export async function handleList(
    options: ListCommandOptions,
    deps: ListHandlerDeps = {},
): Promise<void> {
    // 1. Load the registry
    const registryResult = await loadRegistry();
    if (!registryResult.ok()) {
        throwCoreError(registryResult.error);
    }

    // 2. Format the output as a sorted list of stores
    const stores = Object.entries(registryResult.value)
        .map(([
            name, def,
        ]) => ({ name, path: def.path }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const output: OutputStoreRegistry = { stores };

    // 3. Serialize and output
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const serialized = serializeOutput({ kind: 'store-registry', value: output }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    const out = deps.stdout ?? process.stdout;
    out.write(serialized.value + '\n');
}

/**
 * The `list` subcommand for displaying all registered stores.
 *
 * Reads the store registry and displays all stores sorted alphabetically
 * by name in the specified format.
 *
 * @example
 * ```bash
 * cortex store list
 * cortex store list --format json
 * ```
 */
export const listCommand = new Command('list')
    .description('List all registered stores')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (options) => {
        await handleList(options);
    });
