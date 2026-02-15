/**
 * Init command for initializing the global cortex configuration store.
 *
 * Creates the global config store at ~/.config/cortex/ with:
 * - config.yaml: Global configuration with default settings
 * - stores.yaml: Store registry with a 'default' store pointing to the memory directory
 * - memory/: Default store with 'global' and 'projects' categories
 *
 * @example
 * ```bash
 * # Initialize global cortex configuration
 * cortex init
 *
 * # Reinitialize even if already initialized
 * cortex init --force
 * ```
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import { serializeOutput, type OutputFormat, type OutputInit, type OutputPayload } from '../../output.ts';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { initializeStore } from '@yeseh/cortex-core/store';
import { type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Reinitialize even if already initialized */
    force?: boolean;
    /** Output format (yaml, json, toon) */
    format?: string;
}

/**
 * Dependencies for the init command handler.
 * Allows injection for testing.
 */

/**
 * Default category directories created in the global store.
 * - 'persona': For persona-related memories
 * - 'human': For human-related memories
 */
const DEFAULT_CATEGORIES = [
    'persona', 'human',
] as const;

/**
 * Default configuration content written to config.yaml.
 * Contains all supported configuration options with their default values.
 */
const DEFAULT_CONFIG_CONTENT = `# Cortex global configuration
# See 'cortex --help' for available options

output_format: yaml
auto_summary_threshold: 10
strict_local: false
`;

const formatInit = (path: string, categories: readonly string[]): OutputInit => ({
    path,
    categories: [...categories],
});

const pathExists = async (path: string): Promise<boolean> => {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
};

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Initializes the global cortex config store
 * 2. Creates default categories
 * 3. Outputs the result
 *
 * @param options - Command options (force, format)
 * @param deps - Optional dependencies for testing
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When initialization fails
 */
export async function handleInit(
    ctx: CortexContext,
    options: InitCommandOptions = {},
): Promise<void> {
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');
    const configPath = resolve(cortexConfigDir, 'config.yaml');
    const storesPath = resolve(cortexConfigDir, 'stores.yaml');
    const indexPath = resolve(globalStorePath, 'index.yaml');

    // Check if already initialized (unless --force is specified)
    if (!options.force && (await pathExists(indexPath))) {
        throwCoreError({
            code: 'ALREADY_INITIALIZED',
            message: `Global config store already exists at ${globalStorePath}. Use --force to reinitialize.`,
        });
        return;
    }

    try {
        // Create config directory first
        await mkdir(cortexConfigDir, { recursive: true });

        // Write config.yaml (CLI-specific, not part of domain operation)
        await writeFile(configPath, DEFAULT_CONFIG_CONTENT, 'utf8');

        // Use initializeStore for the actual store setup
        const registry = new FilesystemRegistry(storesPath);
        // Initialize registry first if needed
        await registry.initialize();

        const result = await initializeStore(
            registry,
            'default',
            globalStorePath,
            { categories: [...DEFAULT_CATEGORIES] },
        );

        if (!result.ok()) {
            // Handle STORE_ALREADY_EXISTS during --force scenario
            if (result.error.code === 'STORE_ALREADY_EXISTS' && options.force) {
                // Store exists, that's okay with --force
                // The store already has proper structure, nothing more to do
            }
            else {
                throwCoreError({
                    code: 'INIT_FAILED',
                    message: result.error.message,
                });
                return;
            }
        }
    }
    catch {
        throwCoreError({
            code: 'INIT_FAILED',
            message: `Failed to initialize global config store at ${globalStorePath}.`,
        });
        return;
    }

    // Build output
    const output: OutputPayload = {
        kind: 'init',
        value: formatInit(globalStorePath, DEFAULT_CATEGORIES),
    };

    // Output result
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const outputSerialized = serializeOutput(output, format);
    if (!outputSerialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: outputSerialized.error.message });
        return;
    }

    ctx.stdout.write(outputSerialized.value + '\n');
}

/**
 * The `init` command for initializing the global cortex configuration.
 *
 * Creates the global config store at ~/.config/cortex/ with default settings
 * and store registry.
 *
 * Edge case: If a global store already exists, this command fails unless
 * `--force` is provided.
 *
 * @module commands/init
 * @param ctx - Shared CLI context used to write output for the command.
 * @returns The configured Commander command for `init`.
 *
 * @example
 * ```ts
 * const initCommand = createInitCommand(ctx);
 * program.addCommand(initCommand);
 * ```
 */
export const createInitCommand = (ctx: CortexContext) => {
    return new Command('init')
        .description('Initialize global cortex configuration')
        .option('-F, --force', 'Reinitialize even if already initialized')
        .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
        .action(async (options) => {
            await handleInit(ctx, options);
        });
};
