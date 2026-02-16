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
import { serializeOutput, type OutputStoreRegistry, type OutputFormat } from '../../output.ts';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for the list command.
 */
export interface ListCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Handles the list command execution.
 *
 * This function:
 * 1. Formats the stores as a sorted list from cortex.getStoreDefinitions()
 * 2. Serializes and outputs the result
 *
 * @param ctx - CortexContext with Cortex client and output stream
 * @param options - Command options (format)
 * @throws {CommanderError} When serialization fails
 */
export async function handleList(ctx: CortexContext, options: ListCommandOptions): Promise<void> {
    // 1. Format the output as a sorted list of stores (registry already loaded in ctx)
    const storeDefinitions = ctx.cortex.getStoreDefinitions();
    const stores = Object.entries(storeDefinitions)
        .map(([name, def]) => ({ name, path: def.path }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const output: OutputStoreRegistry = { stores };

    // 2. Serialize and output
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const serialized = serializeOutput({ kind: 'store-registry', value: output }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }

    ctx.stdout.write(serialized.value + '\n');
}

/**
 * Builds the `list` subcommand for displaying all registered stores.
 *
 * Reads the store registry and displays all stores sorted alphabetically
 * by name in the specified format.
 *
 * @param ctx - CortexContext providing the Cortex client and output stream.
 * @returns A configured Commander subcommand for `store list`.
 *
 * @example
 * ```bash
 * cortex store list
 * cortex store list --format json
 * ```
 */
export const createListCommand = (ctx: CortexContext) => {
    return new Command('list')
        .description('List all registered stores')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (options) => {
            await handleList(ctx, options);
        });
};
