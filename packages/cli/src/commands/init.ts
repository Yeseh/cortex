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
import { throwCoreError } from '../errors.ts';
import { serializeOutput, type OutputFormat, type OutputInit, type OutputPayload } from '../output.ts';
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';
import { initializeStore, type Store } from '@yeseh/cortex-core/store';
import { defaultGlobalStoreCategories } from '@yeseh/cortex-core/category'; 
import { getDefaultSettings, type ConfigStore, type CortexConfig, type CortexContext } from '@yeseh/cortex-core';

/**
 * Options for the init command.
 */
export interface InitCommandOptions {
    /** Reinitialize even if already initialized */
    force?: boolean;
    /** Output format (yaml, json, toon) */
    format?: string;
}

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
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When initialization fails
 */
export async function handleInit(
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

        const settings = getDefaultSettings();
        const globalStore: ConfigStore = {
            kind: 'filesystem',
            categoryMode: 'free',
            description: 'Global memory store for Cortex',
            categories: defaultGlobalStoreCategories,
            properties: {
                path: globalStorePath,
            },
        };

        const config: CortexConfig = {
            settings,
            stores: {
                global: globalStore,
            },
        };

        // Write config.yaml (CLI-specific, not part of domain operation)
        const yamlConfig = serializeOutput(config, 'yaml');
        if (!yamlConfig.ok()) {
            throwCoreError({ code: 'SERIALIZE_FAILED', message: yamlConfig.error.message });
        }

        await writeFile(configPath, yamlConfig.value, 'utf8');

        // Use initializeStore for the actual store setup
        const registry = new FilesystemRegistry(storesPath);
        // Initialize registry first if needed
        await registry.initialize();

        const result = await initializeStore(
            'default',
            globalStorePath,
            { categories: { ...defaultGlobalStoreCategories } },
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
        value: formatInit(globalStorePath, Object.keys(defaultGlobalStoreCategories)),
    };

    // Output result
    const format: OutputFormat = (options.format as OutputFormat) ?? 'yaml';
    const outputSerialized = serializeOutput(output, format);
    if (!outputSerialized.ok()) {
        throwCoreError({ code: 'SERIALIZE_FAILED', message: outputSerialized.error.message });
        return;
    }

    const out = deps.stdout ?? process.stdout;
    out.write(outputSerialized.value + '\n');
}

/**
 * The `init` command for initializing the global cortex configuration.
 *
 * Creates the global config store at ~/.config/cortex/ with default settings
 * and store registry.
 *
 * @example
 * ```bash
 * cortex init              # Initialize global config
 * cortex init --force      # Reinitialize even if exists
 * ```
 */
export const initCommand = new Command('init')
    .description('Initialize global cortex configuration')
    .option('-F, --force', 'Reinitialize even if already initialized')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)', 'yaml')
    .action(async (options) => {
        await handleInit(options);
    });
