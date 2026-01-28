/**
 * Init command for initializing the global cortex configuration store.
 *
 * Creates the global config store at ~/.config/cortex/ with:
 * - config.yaml: Global configuration with default settings
 * - stores.yaml: Store registry with a 'default' store pointing to the memory directory
 * - memory/: Default global store with 'global' and 'projects' categories
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import { serializeIndex } from '../../core/serialization.ts';
import { serializeStoreRegistry } from '../../core/store/registry.ts';
import type { OutputPayload, OutputInit } from '../output.ts';

export interface InitCommandOptions {
    args: string[];
    cwd: string;
}

export interface InitCommandResult {
    output: OutputPayload;
}

export type InitCommandErrorCode = 'INIT_FAILED' | 'ALREADY_INITIALIZED' | 'INVALID_ARGUMENTS';

export interface InitCommandError {
    code: InitCommandErrorCode;
    message: string;
    cause?: unknown;
}

type InitResult = Result<InitCommandResult, InitCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

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

const buildEmptyRootIndex = (
    subcategories: readonly string[],
): Result<string, InitCommandError> => {
    const serialized = serializeIndex({
        memories: [],
        subcategories: subcategories.map((name) => ({ path: name, memoryCount: 0 })),
    });
    if (!serialized.ok) {
        return err({
            code: 'INIT_FAILED',
            message: 'Failed to serialize root index.',
            cause: serialized.error,
        });
    }
    return ok(serialized.value);
};

const buildEmptyCategoryIndex = (): Result<string, InitCommandError> => {
    const serialized = serializeIndex({
        memories: [],
        subcategories: [],
    });
    if (!serialized.ok) {
        return err({
            code: 'INIT_FAILED',
            message: 'Failed to serialize category index.',
            cause: serialized.error,
        });
    }
    return ok(serialized.value);
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

const parseInitArgs = (args: string[]): Result<{ force: boolean }, InitCommandError> => {
    let force = false;

    for (const arg of args) {
        if (!arg) {
            continue;
        }
        if (arg === '--force' || arg === '-f') {
            force = true;
            continue;
        }
        if (arg.startsWith('-')) {
            return err({
                code: 'INVALID_ARGUMENTS',
                message: `Unknown flag: ${arg}.`,
            });
        }
        return err({
            code: 'INVALID_ARGUMENTS',
            message: `Unexpected argument: ${arg}. The init command does not accept positional arguments.`,
        });
    }

    return ok({ force });
};

export const runInitCommand = async (options: InitCommandOptions): Promise<InitResult> => {
    const parsedArgs = parseInitArgs(options.args);
    if (!parsedArgs.ok) {
        return parsedArgs;
    }

    const { force } = parsedArgs.value;
    const cortexConfigDir = resolve(homedir(), '.config', 'cortex');
    const globalStorePath = resolve(cortexConfigDir, 'memory');
    const configPath = resolve(cortexConfigDir, 'config.yaml');
    const storesPath = resolve(cortexConfigDir, 'stores.yaml');
    const indexPath = resolve(globalStorePath, 'index.yaml');

    // Check if already initialized (unless --force is specified)
    if (!force && (await pathExists(indexPath))) {
        return err({
            code: 'ALREADY_INITIALIZED',
            message: `Global config store already exists at ${globalStorePath}. Use --force to reinitialize.`,
        });
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
                return categoryIndex;
            }
            await writeFile(categoryIndexPath, categoryIndex.value, 'utf8');
        }

        // Create root config files at cortexConfigDir level
        await writeFile(configPath, DEFAULT_CONFIG_CONTENT, 'utf8');

        // Serialize and write stores registry
        const serialized = serializeStoreRegistry({ default: { path: globalStorePath } });
        if (!serialized.ok) {
            return err({
                code: 'INIT_FAILED',
                message: 'Failed to serialize store registry.',
                cause: serialized.error,
            });
        }
        await writeFile(storesPath, serialized.value + '\n', 'utf8');

        // Create root index
        const rootIndex = buildEmptyRootIndex(DEFAULT_CATEGORIES);
        if (!rootIndex.ok) {
            return rootIndex;
        }
        await writeFile(indexPath, rootIndex.value, 'utf8');
    }
    catch (error) {
        return err({
            code: 'INIT_FAILED',
            message: `Failed to initialize global config store at ${globalStorePath}.`,
            cause: error,
        });
    }

    return ok({
        output: {
            kind: 'init',
            value: formatInit(globalStorePath, DEFAULT_CATEGORIES),
        },
    });
};
