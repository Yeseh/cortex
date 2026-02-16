/**
 * Store remove command for unregistering a store.
 *
 * This command removes a store from the global registry. Note that this
 * only unregisters the store - it does not delete the actual data.
 *
 * @example
 * ```bash
 * # Remove a store from the registry
 * cortex store remove work
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { isValidStoreName } from '@yeseh/cortex-core/store';
import { serializeOutput, type OutputStore, type OutputFormat } from '../../output.ts';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for the remove command.
 */
export interface RemoveCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Validates store name input.
 *
 * @param name - The raw store name input
 * @returns The validated, trimmed store name
 * @throws {InvalidArgumentError} When the store name is empty or invalid
 */
function validateStoreName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throwCoreError({ code: 'INVALID_STORE_NAME', message: 'Store name is required.' });
    }
    if (!isValidStoreName(trimmed)) {
        throwCoreError({
            code: 'INVALID_STORE_NAME',
            message: 'Store name must be a lowercase slug.',
        });
    }
    return trimmed;
}

/**
 * Writes the serialized output to the output stream.
 *
 * @param output - The store output payload
 * @param format - The output format
 * @param stdout - The output stream
 */
function writeOutput(
    output: OutputStore,
    format: OutputFormat,
    stdout: NodeJS.WritableStream
): void {
    const serialized = serializeOutput({ kind: 'store', value: output }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the remove command execution.
 *
 * This function:
 * 1. Validates the store name format
 * 2. Gets the store path before removal (for output)
 * 3. Removes the store from the registry via Cortex
 * 4. Outputs the result
 *
 * @param ctx - CortexContext with output stream
 * @param name - The store name to unregister
 * @param options - Command options (format)
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store doesn't exist or registry operations fail
 */
export async function handleRemove(
    ctx: CortexContext,
    name: string,
    options: RemoveCommandOptions = {}
): Promise<void> {
    // 1. Validate store name
    const trimmedName = validateStoreName(name);

    // 2. Get store path before removal (for output)
    const existingStore = ctx.cortex.registry[trimmedName];
    if (!existingStore) {
        throwCoreError({
            code: 'STORE_NOT_FOUND',
            message: `Store '${trimmedName}' is not registered.`,
        });
    }
    const storePath = existingStore.path;

    // 3. Remove from registry via Cortex
    const removeResult = await ctx.cortex.removeStore(trimmedName);
    if (!removeResult.ok()) {
        throwCoreError({ code: removeResult.error.code, message: removeResult.error.message });
    }

    // 4. Output result
    const output: OutputStore = { name: trimmedName, path: storePath };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, ctx.stdout);
}

/**
 * Builds the `remove` subcommand for unregistering a store.
 *
 * Removes a store from the registry. This only unregisters the store
 * from the global registry - it does not delete the actual data.
 *
 * @param ctx - CortexContext providing the Cortex client and output stream.
 * @returns A configured Commander subcommand for `store remove`.
 *
 * @example
 * ```bash
 * cortex store remove work
 * cortex store remove project --format json
 * ```
 */
export const createRemoveCommand = (ctx: CortexContext) => {
    return new Command('remove')
        .description('Unregister a store from the registry')
        .argument('<name>', 'Store name to remove')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (name, options) => {
            await handleRemove(ctx, name, options);
        });
};
