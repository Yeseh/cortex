/**
 * Store add command for registering a new store.
 *
 * This command registers a new store in the global registry with a given
 * name and filesystem path. Paths are resolved relative to the current
 * working directory, with support for tilde expansion.
 *
 * @example
 * ```bash
 * # Register a store with an absolute path
 * cortex store add work /path/to/work/memories
 *
 * # Register a store with a relative path
 * cortex store add project ./cortex
 *
 * # Register a store with tilde expansion
 * cortex store add personal ~/memories
 * ```
 */

import { Command } from '@commander-js/extra-typings';
import type { CortexContext } from '@yeseh/cortex-core';
import { isValidStoreName } from '@yeseh/cortex-core/store';
import { throwCoreError } from '../../errors.ts';
import { type OutputFormat, type OutputStore, serializeOutput } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';

/**
 * Options for the add command.
 */
export interface AddCommandOptions {
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
        throwCoreError({
            code: 'INVALID_STORE_NAME',
            message: 'Store name is required.',
        });
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
 * Validates and resolves store path input.
 *
 * @param storePath - The raw store path input
 * @param cwd - The current working directory for relative path resolution
 * @returns The resolved absolute path
 * @throws {InvalidArgumentError} When the store path is empty
 */
function validateAndResolvePath(storePath: string, cwd: string): string {
    const trimmed = storePath.trim();
    if (!trimmed) {
        throwCoreError({
            code: 'INVALID_STORE_PATH',
            message: 'Store path is required.',
        });
    }
    return resolveUserPath(trimmed, cwd);
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
        throwCoreError({
            code: 'SERIALIZE_FAILED',
            message: serialized.error.message,
        });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the add command execution.
 *
 * This function:
 * 1. Validates the store name format
 * 2. Validates and resolves the store path
 * 3. Checks for existing store with the same name
 * 4. Adds the store via Cortex (persists to config.yaml)
 * 5. Outputs the result
 *
 * @param ctx - CortexContext with Cortex client and output stream.
 * @param name - The store name to register.
 * @param storePath - The filesystem path to the store.
 * @param options - Command options (format).
 * @returns Promise that resolves after output is written.
 * @throws {InvalidArgumentError} When the store name or path is invalid
 * @throws {CommanderError} When the store already exists or registry operations fail
 */
export async function handleAdd(
    ctx: CortexContext,
    name: string,
    storePath: string,
    options: AddCommandOptions = {}
): Promise<void> {
    const cwd = process.cwd();

    // 1. Validate inputs
    const trimmedName = validateStoreName(name);
    const resolvedPath = validateAndResolvePath(storePath, cwd);

    // 2. Check for existing store
    if (ctx.cortex.registry[trimmedName]) {
        throwCoreError({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${trimmedName}' is already registered.`,
        });
    }

    // 3. Add store using Cortex (this persists to config.yaml)
    const addResult = await ctx.cortex.addStore(trimmedName, {
        path: resolvedPath,
    });
    if (!addResult.ok()) {
        throwCoreError({
            code: 'STORE_REGISTRY_FAILED',
            message: addResult.error.message,
        });
    }

    // 4. Output result
    const output: OutputStore = { name: trimmedName, path: resolvedPath };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, ctx.stdout);
}

/**
 * Builds the `add` subcommand for registering a new store.
 *
 * Registers a store with the given name and filesystem path. The path is
 * resolved relative to the current working directory, with support for
 * tilde expansion.
 *
 * @param ctx - CortexContext providing the Cortex client and output stream.
 * @returns A configured Commander subcommand for `store add`.
 *
 * @example
 * ```bash
 * cortex store add work /path/to/work/memories
 * cortex store add project ./cortex --format json
 * ```
 */
export const createAddCommand = (ctx: CortexContext) => {
    return new Command('add')
        .description('Register a new store')
        .argument('<name>', 'Store name (lowercase slug)')
        .argument('<path>', 'Filesystem path to the store')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (name, path, options) => {
            await handleAdd(ctx, name, path, options);
        });
};
