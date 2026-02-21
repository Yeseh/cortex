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
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { serializeOutput, type OutputStore, type OutputFormat } from '../../output.ts';
import { Slug } from '@yeseh/cortex-core';

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
 * 2. Loads the existing registry
 * 3. Checks that the store exists
 * 4. Removes the store from the registry and saves
 * 5. Outputs the result
 *
 * @param name - The store name to unregister
 * @param options - Command options (format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name is invalid
 * @throws {CommanderError} When the store doesn't exist or registry operations fail
 */
export async function handleRemove(
    name: string,
    options: RemoveCommandOptions = {},
    deps: RemoveHandlerDeps = {},
): Promise<void> {
    const registryPath = getDefaultConfigPath();

    // 1. Validate store name
    const trimmedName = validateStoreName(name);

    // 2. Load existing registry
    const registry = new FilesystemRegistry(registryPath);
    const loadResult = await registry.load();
    // Handle REGISTRY_MISSING - if registry doesn't exist, nothing to remove
    if (!loadResult.ok()) {
        if (loadResult.error.code === 'REGISTRY_MISSING') {
            throwCliError({ code: 'STORE_NOT_FOUND', message: `Store '${trimmedName}' is not registered.` });
        }
        throwCliError({ code: 'STORE_REGISTRY_FAILED', message: loadResult.error.message });
    }

    // 3. Check store exists
    const existingStore = loadResult.value[trimmedName];
    if (!existingStore) {
        throwCliError({ code: 'STORE_NOT_FOUND', message: `Store '${trimmedName}' is not registered.` });
    }

    // 4. Remove from registry and save (even if registry would be empty, just save empty registry)
    const { [trimmedName]: _removed, ...rest } = loadResult.value;
    const saveResult = await registry.save(rest);
    if (!saveResult.ok()) {
        throwCliError({ code: 'STORE_REGISTRY_FAILED', message: saveResult.error.message });
    }

    // 5. Output result
    const output: OutputStore = { name: trimmedName, path: existingStore.path };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, deps.stdout ?? process.stdout);
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
        await handleRemove(name, options);
    });
