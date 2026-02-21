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
import { throwCliError } from '../../errors.ts';
import { getDefaultConfigPath } from '../../context.ts';
import { serializeOutput, type OutputStore, type OutputFormat } from '../../output.ts';
import { Slug, parseConfig, type CortexContext } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

/**
 * Options for the remove command.
 */
export interface RemoveCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Dependencies for the remove command handler.
 * Allows injection for testing.
 */
export interface RemoveHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
}

/**
 * Validates store name input.
 *
 * @param name - The raw store name input
 * @returns The validated, trimmed store name
 * @throws {InvalidArgumentError} When the store name is empty or invalid
 */
function validateStoreName(name: string): string {
    const slugResult = Slug.from(name);
    if (!slugResult.ok()) {
        throwCliError({ code: 'INVALID_STORE_NAME', message: 'Store name must be a lowercase slug (letters, numbers, hyphens).' });
    }

    return slugResult.value.toString();
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
    stdout: NodeJS.WritableStream,
): void {
    const serialized = serializeOutput({ kind: 'store', value: output }, format);
    if (!serialized.ok()) {
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the remove command execution.
 *
 * This function:
 * 1. Validates the store name format
 * 2. Checks that the store exists in context
 * 3. Reads current config file
 * 4. Removes the store from the config and saves
 * 5. Outputs the result
 *
 * @param ctx - The Cortex context
 * @param name - The store name to unregister
 * @param options - Command options (format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store doesn't exist or config operations fail
 */
export async function handleRemove(
    ctx: CortexContext,
    name: string,
    options: RemoveCommandOptions = {},
    deps: RemoveHandlerDeps = {},
): Promise<void> {
    const stdout = deps.stdout ?? ctx.stdout ?? process.stdout;
    const configPath = getDefaultConfigPath();

    // 1. Validate store name
    const trimmedName = validateStoreName(name);

    // 2. Check if store exists in context
    const existingStore = ctx.stores[trimmedName];
    if (!existingStore) {
        throwCliError({ 
            code: 'STORE_NOT_FOUND', 
            message: `Store '${trimmedName}' is not registered.`, 
        });
    }

    // Get the path from the existing store before removing
    const storePath = (existingStore.properties as { path: string }).path;

    // 3. Read current config file
    const configFile = Bun.file(configPath);
    let configContents: string;
    try {
        configContents = await configFile.text();
    }
    catch {
        throwCliError({ 
            code: 'CONFIG_READ_FAILED', 
            message: `Failed to read config at ${configPath}`, 
        });
    }

    const configResult = parseConfig(configContents);
    if (!configResult.ok()) {
        throwCliError(configResult.error);
    }

    // 4. Remove store from config
    const { [trimmedName]: _removed, ...remainingStores } = configResult.value.stores ?? {};

    const updatedConfig = {
        ...configResult.value,
        stores: remainingStores,
    };

    // 5. Write updated config
    const serialized = Bun.YAML.stringify(updatedConfig, null, 2);
    try {
        await Bun.write(configPath, serialized);
    }
    catch {
        throwCliError({ 
            code: 'CONFIG_WRITE_FAILED', 
            message: `Failed to write config at ${configPath}`, 
        });
    }

    // 6. Output result
    const output: OutputStore = { name: trimmedName, path: storePath };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, stdout);
}

/**
 * The `remove` subcommand for unregistering a store.
 *
 * Removes a store from the registry. This only unregisters the store
 * from the global registry - it does not delete the actual data.
 *
 * @example
 * ```bash
 * cortex store remove work
 * cortex store remove project --format json
 * ```
 */
export const removeCommand = new Command('remove')
    .description('Unregister a store from the registry')
    .argument('<name>', 'Store name to remove')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (name, options) => {
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }
        await handleRemove(context.value, name, options);
    });
