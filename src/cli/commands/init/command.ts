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
import { mapCoreError } from '../../errors.ts';
import { serializeOutput, type OutputFormat, type OutputInit, type OutputPayload } from '../../output.ts';
import { serializeIndex } from '../../../core/serialization.ts';
import { serializeStoreRegistry } from '../../../core/store/registry.ts';

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
export interface InitHandlerDeps {
    /** Output stream for writing results (defaults to process.stdout) */
    stdout?: NodeJS.WritableStream;
}

/**
 * Default category directories created in the global store.
 * - 'global': For memories that apply across all projects
 * - 'projects': For project-specific memories
 */
const DEFAULT_CATEGORIES = [
    'global', 'projects',
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

interface InitError {
    code: string;
    message: string;
    cause?: unknown;
}

const buildEmptyRootIndex = (
    subcategories: readonly string[],
): { ok: true; value: string } | { ok: false; error: InitError } => {
    const serialized = serializeIndex({
        memories: [],
        subcategories: subcategories.map((name) => ({ path: name, memoryCount: 0 })),
    });
    if (!serialized.ok) {
        return {
            ok: false,
            error: {
                code: 'INIT_FAILED',
                message: 'Failed to serialize root index.',
                cause: serialized.error,
            },
        };
    }
    return { ok: true, value: serialized.value };
};

type IndexResult = { ok: true; value: string } | { ok: false; error: InitError };

const buildEmptyCategoryIndex = (): IndexResult => {
    const serialized = serializeIndex({
        memories: [],
        subcategories: [],
    });
    if (!serialized.ok) {
        return {
            ok: false,
            error: {
                code: 'INIT_FAILED',
                message: 'Failed to serialize category index.',
                cause: serialized.error,
            },
        };
    }
    return { ok: true, value: serialized.value };
};

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
    options: InitCommandOptions = {},
    deps: InitHandlerDeps = {},
): Promise<void> {
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');
    const configPath = resolve(cortexConfigDir, 'config.yaml');
    const storesPath = resolve(cortexConfigDir, 'stores.yaml');
    const indexPath = resolve(globalStorePath, 'index.yaml');

    // Check if already initialized (unless --force is specified)
    if (!options.force && (await pathExists(indexPath))) {
        mapCoreError({
            code: 'ALREADY_INITIALIZED',
            message: `Global config store already exists at ${globalStorePath}. Use --force to reinitialize.`,
        });
        return;
    }

    try {
        // Create the main store directory
        await mkdir(globalStorePath, { recursive: true });

        // Create category directories and their indexes
        for (const category of DEFAULT_CATEGORIES) {
            const categoryPath = resolve(globalStorePath, category);
            await mkdir(categoryPath, { recursive: true });

            const categoryIndexPath = resolve(categoryPath, 'index.yaml');
            const categoryIndex = buildEmptyCategoryIndex();
            if (!categoryIndex.ok) {
                mapCoreError(categoryIndex.error);
                return;
            }
            await writeFile(categoryIndexPath, categoryIndex.value, 'utf8');
        }

        // Create root config files at cortexConfigDir level
        await writeFile(configPath, DEFAULT_CONFIG_CONTENT, 'utf8');

        // Serialize and write stores registry
        const serialized = serializeStoreRegistry({ default: { path: globalStorePath } });
        if (!serialized.ok) {
            mapCoreError({
                code: 'INIT_FAILED',
                message: 'Failed to serialize store registry.',
            });
            return;
        }
        await writeFile(storesPath, serialized.value + '\n', 'utf8');

        // Create root index
        const rootIndex = buildEmptyRootIndex(DEFAULT_CATEGORIES);
        if (!rootIndex.ok) {
            mapCoreError(rootIndex.error);
            return;
        }
        await writeFile(indexPath, rootIndex.value, 'utf8');
    }
    catch {
        mapCoreError({
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
    if (!outputSerialized.ok) {
        mapCoreError({ code: 'SERIALIZE_FAILED', message: outputSerialized.error.message });
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
