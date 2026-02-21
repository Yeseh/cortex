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
import { throwCoreError } from '../../errors.ts';
import { getDefaultConfigPath } from '../../context.ts';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { serializeOutput, type OutputStore, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';
import { Slug } from '@yeseh/cortex-core';

/**
 * Options for the add command.
 */
export interface AddCommandOptions {
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Dependencies for the add command handler.
 * Allows injection for testing.
 */
export interface AddHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
    /** Current working directory (defaults to process.cwd()) */
    cwd?: string;
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
        throwCoreError({ code: 'INVALID_STORE_NAME', message: 'Store name must be a lowercase slug (letters, numbers, hyphens).' });
    }

    return slugResult.value.toString();
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
        throwCoreError({ code: 'INVALID_STORE_PATH', message: 'Store path is required.' });
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
    stdout: NodeJS.WritableStream,
): void {
    const serialized = serializeOutput({ kind: 'store', value: output }, format);
    if (!serialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the add command execution.
 *
 * This function:
 * 1. Validates the store name format
 * 2. Validates and resolves the store path
 * 3. Loads the existing registry
 * 4. Checks for existing store with the same name
 * 5. Adds the store to the registry and saves
 * 6. Outputs the result
 *
 * @param name - The store name to register
 * @param storePath - The filesystem path to the store
 * @param options - Command options (format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name or path is invalid
 * @throws {CommanderError} When the store already exists or registry operations fail
 */
export async function handleAdd(
    name: string,
    storePath: string,
    options: AddCommandOptions = {},
    deps: AddHandlerDeps = {},
): Promise<void> {
    const cwd = deps.cwd ?? process.cwd();
    const registryPath = getDefaultConfigPath();

    // 1. Validate inputs
    const trimmedName = validateStoreName(name);
    const resolvedPath = validateAndResolvePath(storePath, cwd);

    // 2. Load existing registry
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();

    if (!registryResult.ok()) {
        throwCoreError({ code: 'STORE_REGISTRY_FAILED', message: registryResult.error.message });
    }

    // 3. Check for existing store
    const currentRegistry = registryResult.value;
    const currentStore = currentRegistry.getStore(trimmedName);
    if (currentStore.ok()) {
        throwCoreError({ code: 'STORE_ALREADY_EXISTS', message: `Store '${trimmedName}' is already registered.` });
    }

    // 4. Add to registry and save
    currentRegistry.addStore({ name: trimmedName, path: resolvedPath });
    const saved = await registry.save(currentRegistry);
    if (!saved.ok()) {
        throwCoreError({ code: 'STORE_REGISTRY_FAILED', message: saved.error.message });
    }

    // 5. Output result
    const output: OutputStore = { name: trimmedName, path: resolvedPath };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, deps.stdout ?? process.stdout);
}

/**
 * The `add` subcommand for registering a new store.
 *
 * Registers a store with the given name and filesystem path. The path is
 * resolved relative to the current working directory, with support for
 * tilde expansion.
 *
 * @example
 * ```bash
 * cortex store add work /path/to/work/memories
 * cortex store add project ./cortex --format json
 * ```
 */
export const addCommand = new Command('add')
    .description('Register a new store')
    .argument('<name>', 'Store name (lowercase slug)')
    .argument('<path>', 'Filesystem path to the store')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (name, path, options) => {
        await handleAdd(name, path, options);
    });
