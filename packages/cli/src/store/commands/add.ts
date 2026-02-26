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
import { throwCliError } from '../../errors.ts';
import { getDefaultConfigPath } from '../../context.ts';
import { serializeOutput, type OutputStore, type OutputFormat } from '../../output.ts';
import { resolveUserPath } from '../../paths.ts';
import { Slug, parseConfig, type CortexContext, type ConfigStore } from '@yeseh/cortex-core';
import { createCliCommandContext } from '../../create-cli-command.ts';

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
        throwCliError({
            code: 'INVALID_STORE_NAME',
            message: 'Store name must be a lowercase slug (letters, numbers, hyphens).',
        });
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
        throwCliError({ code: 'INVALID_STORE_PATH', message: 'Store path is required.' });
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
        throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
    }
    stdout.write(serialized.value + '\n');
}

/**
 * Handles the add command execution.
 *
 * This function:
 * 1. Validates the store name format
 * 2. Validates and resolves the store path
 * 3. Checks if store already exists in context
 * 4. Reads current config file
 * 5. Adds the store to the config and saves
 * 6. Outputs the result
 *
 * @param ctx - The CortexContext with loaded configuration
 * @param name - The store name to register
 * @param storePath - The filesystem path to the store
 * @param options - Command options (format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When the store name or path is invalid
 * @throws {CommanderError} When the store already exists or config operations fail
 */
export async function handleAdd(
    ctx: CortexContext,
    name: string,
    storePath: string,
    options: AddCommandOptions = {},
    deps: AddHandlerDeps = {},
): Promise<void> {
    const cwd = ctx.cwd ?? process.cwd();
    const stdout = deps.stdout ?? ctx.stdout ?? process.stdout;
    const configPath = getDefaultConfigPath();

    // 1. Validate inputs
    const trimmedName = validateStoreName(name);
    const resolvedPath = validateAndResolvePath(storePath, cwd);

    // 2. Check if store already exists in context
    if (ctx.stores[trimmedName]) {
        throwCliError({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${trimmedName}' is already registered.`,
        });
    }

    // 3. Read current config file (or start with empty config if it doesn't exist)
    const configFile = Bun.file(configPath);
    let configResult: {
        value: { settings?: unknown; stores: Record<string, unknown> };
        ok: () => boolean;
    };

    if (await configFile.exists()) {
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

        const parsed = parseConfig(configContents);
        if (!parsed.ok()) {
            throwCliError(parsed.error);
        }
        configResult = parsed;
    }
    else {
        // Config doesn't exist yet — start with empty config
        configResult = { value: { settings: undefined, stores: {} }, ok: () => true };
        // Ensure config directory exists
        const { mkdir } = await import('node:fs/promises');
        const { dirname } = await import('node:path');
        await mkdir(dirname(configPath), { recursive: true });
    }

    // 4. Add new store to config
    const newStore: ConfigStore = {
        kind: 'filesystem',
        categoryMode: 'free',
        categories: {},
        properties: { path: resolvedPath },
    };

    const updatedConfig = {
        ...configResult.value,
        stores: {
            ...configResult.value.stores,
            [trimmedName]: newStore,
        },
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
    const output: OutputStore = { name: trimmedName, path: resolvedPath };
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    writeOutput(output, format, stdout);
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
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }
        await handleAdd(context.value, name, path, options);
    });
