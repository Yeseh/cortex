/**
 * Init command for initializing the global cortex configuration store.
 *
 * Creates the global config store at ~/.config/cortex/ with two default
 * categories: 'global' and 'projects'.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import { serializeCategoryIndex } from '../../core/index/parser.ts';
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

const DEFAULT_CATEGORIES = ['global', 'projects'] as const;

const formatInit = (path: string, categories: readonly string[]): OutputInit => ({
    path,
    categories: [...categories],
});

const buildEmptyRootIndex = (
    subcategories: readonly string[]
): Result<string, InitCommandError> => {
    const serialized = serializeCategoryIndex({
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
    const serialized = serializeCategoryIndex({
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
    } catch {
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
    const globalStorePath = resolve(cortexConfigDir, '.cortex');
    const configPath = resolve(globalStorePath, 'config.yaml');
    const indexPath = resolve(globalStorePath, 'index.yaml');

    // Check if already initialized (unless --force is specified)
    if (!force && (await pathExists(indexPath))) {
        return err({
            code: 'ALREADY_INITIALIZED',
            message: `Global config store already exists at ${globalStorePath}. Use --force to reinitialize.`,
        });
    }

    try {
        // Create the main directories
        await mkdir(globalStorePath, { recursive: true });

        // Create memory directory
        const memoryPath = resolve(globalStorePath, 'memory');
        await mkdir(memoryPath, { recursive: true });

        // Create category directories and their indexes
        for (const category of DEFAULT_CATEGORIES) {
            const categoryPath = resolve(globalStorePath, 'indexes', category);
            await mkdir(categoryPath, { recursive: true });

            const categoryIndexPath = resolve(categoryPath, 'index.yaml');
            const categoryIndex = buildEmptyCategoryIndex();
            if (!categoryIndex.ok) {
                return categoryIndex;
            }
            await writeFile(categoryIndexPath, categoryIndex.value, 'utf8');

            // Create category memory directories
            const categoryMemoryPath = resolve(globalStorePath, 'memory', category);
            await mkdir(categoryMemoryPath, { recursive: true });
        }

        // Create root config and index
        await writeFile(configPath, '', 'utf8');

        const rootIndex = buildEmptyRootIndex(DEFAULT_CATEGORIES);
        if (!rootIndex.ok) {
            return rootIndex;
        }
        await writeFile(indexPath, rootIndex.value, 'utf8');
    } catch (error) {
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
