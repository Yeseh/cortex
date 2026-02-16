/**
 * Init command for initializing the global cortex configuration store.
 *
 * Creates the global config store at ~/.config/cortex/ with:
 * - config.yaml: Global configuration with default settings and store registry
 * - memory/: Default store with 'persona' and 'human' categories
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

import { stat, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { throwCoreError } from '../../errors.ts';
import {
    serializeOutput,
    type OutputFormat,
    type OutputInit,
    type OutputPayload,
} from '../../output.ts';
import { Cortex, type CortexContext } from '@yeseh/cortex-core';
import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';

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
const DEFAULT_CATEGORIES = ['persona', 'human'] as const;

const formatInit = (path: string, categories: readonly string[]): OutputInit => ({
    path,
    categories: [...categories],
});

const pathExists = async (path: string): Promise<boolean> => {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
};

/**
 * Handles the init command execution.
 *
 * This function:
 * 1. Creates a Cortex instance with the default store
 * 2. Calls cortex.initialize() to create config.yaml
 * 3. Creates the default store directory structure
 * 4. Outputs the result
 *
 * @param _ctx - Command context (unused, init creates its own Cortex instance)
 * @param options - Command options (force, format)
 * @throws {InvalidArgumentError} When arguments are invalid
 * @throws {CommanderError} When initialization fails
 */
export async function handleInit(
    _ctx: CortexContext,
    options: InitCommandOptions = {}
): Promise<void> {
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');
    const configPath = resolve(cortexConfigDir, 'config.yaml');

    // Check if already initialized (unless --force is specified)
    if (!options.force && (await pathExists(configPath))) {
        throwCoreError({
            code: 'ALREADY_INITIALIZED',
            message: `Global config already exists at ${configPath}. Use --force to reinitialize.`,
        });
        return;
    }

    try {
        // Create a Cortex instance with the default store pointing to memory/
        const cortex = Cortex.init({
            rootDirectory: cortexConfigDir,
            registry: {
                default: {
                    path: globalStorePath,
                    description: 'Default global memory store',
                },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        // Initialize creates the config directory and writes config.yaml
        const initResult = await cortex.initialize();
        if (!initResult.ok()) {
            throwCoreError({
                code: 'INIT_FAILED',
                message: initResult.error.message,
            });
            return;
        }

        // Create the default store directory with categories
        await mkdir(globalStorePath, { recursive: true });
        for (const category of DEFAULT_CATEGORIES) {
            await mkdir(resolve(globalStorePath, category), { recursive: true });
        }
    } catch (error) {
        // Re-throw if it's already a core error (from throwCoreError)
        if (error && typeof error === 'object' && 'exitCode' in error) {
            throw error;
        }
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

    _ctx.stdout.write(outputSerialized.value + '\n');
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
