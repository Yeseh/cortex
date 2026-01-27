/**
 * Store management commands for the CLI.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import type {
    OutputPayload,
    OutputStore,
    OutputStoreRegistry,
    OutputStoreInit,
} from '../output.ts';
import {
    isValidStoreName,
    loadStoreRegistry,
    saveStoreRegistry,
    removeStoreRegistry,
} from '../../core/store/registry.ts';
import { serializeIndex } from '../../core/serialization.ts';

export interface StoreCommandOptions {
    args: string[];
    cwd: string;
    registryPath: string;
}

export interface StoreCommandResult {
    output: OutputPayload;
}

export type StoreCommandErrorCode =
    | 'INVALID_COMMAND'
    | 'INVALID_STORE_NAME'
    | 'INVALID_STORE_PATH'
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_REGISTRY_FAILED'
    | 'STORE_INIT_FAILED';

export interface StoreCommandError {
    code: StoreCommandErrorCode;
    message: string;
    cause?: unknown;
}

type StoreRegistryPayload = Record<string, { path: string }>;
type LoadRegistryResult = Result<StoreRegistryPayload, StoreCommandError>;
type StoreResult = Result<StoreCommandResult, StoreCommandError>;

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const formatRegistry = (registry: Record<string, { path: string }>): OutputStoreRegistry => ({
    stores: Object.entries(registry)
        .map(([name, definition]) => ({ name, path: definition.path }))
        .sort((left, right) => left.name.localeCompare(right.name)),
});

const formatStore = (name: string, path: string): OutputStore => ({ name, path });

const formatStoreInit = (path: string): OutputStoreInit => ({ path });

const validateStoreNameInput = (name: string): Result<string, StoreCommandError> => {
    const trimmed = name.trim();
    if (!trimmed) {
        return err({
            code: 'INVALID_STORE_NAME',
            message: 'Store name is required.',
        });
    }
    if (!isValidStoreName(trimmed)) {
        return err({
            code: 'INVALID_STORE_NAME',
            message: 'Store name must be a lowercase slug.',
        });
    }
    return ok(trimmed);
};

const validateStorePathInput = (path: string): Result<string, StoreCommandError> => {
    const trimmed = path.trim();
    if (!trimmed) {
        return err({
            code: 'INVALID_STORE_PATH',
            message: 'Store path is required.',
        });
    }
    return ok(trimmed);
};

/**
 * Checks if a path is absolute (Unix or Windows style).
 *
 * Detects:
 * - Unix absolute paths starting with `/`
 * - Windows drive paths like `C:/` or `C:\`
 * - Windows UNC paths like `\\server\share` or `//server/share`
 *
 * @param inputPath - The path to check
 * @returns `true` if the path is absolute, `false` otherwise
 */
const isAbsolutePath = (inputPath: string): boolean => {
    // Unix absolute path
    if (inputPath.startsWith('/')) {
        return true;
    }
    // Windows absolute path (e.g., C:/ or C:\)
    if (/^[a-zA-Z]:[/\\]/.test(inputPath)) {
        return true;
    }
    // Windows UNC paths (e.g., \\server\share or //server/share)
    if (inputPath.startsWith('\\\\') || inputPath.startsWith('//')) {
        return true;
    }
    return false;
};

/**
 * Resolves a store path to an absolute path.
 *
 * Path resolution rules:
 * - Tilde (`~`) is expanded to the user's home directory
 * - Relative paths are resolved against the current working directory
 * - Absolute paths are normalized (resolving `.` and `..` segments)
 *
 * Note: The `~username` syntax (Unix convention for other users' home directories)
 * is not supported. Paths like `~bob` will be resolved as `<home>/bob`.
 *
 * @param inputPath - The path provided by the user
 * @param cwd - The current working directory for relative path resolution
 * @returns The resolved absolute path
 *
 * @example
 * // Relative paths
 * resolveStorePath('./store', '/home/user')  // '/home/user/store'
 * resolveStorePath('../other', '/home/user') // '/home/other'
 *
 * @example
 * // Tilde expansion
 * resolveStorePath('~/memories', '/anywhere') // '/home/user/memories' (on Unix)
 *
 * @example
 * // Absolute paths (normalized)
 * resolveStorePath('/opt/../etc', '/anywhere') // '/etc'
 */
const resolveStorePath = (inputPath: string, cwd: string): string => {
    // Handle tilde expansion
    if (inputPath.startsWith('~')) {
        const home = homedir();
        return resolve(home, inputPath.slice(1).replace(/^[/\\]/, ''));
    }
    // Normalize absolute paths (resolves .. and . segments)
    if (isAbsolutePath(inputPath)) {
        return resolve(inputPath);
    }
    // Resolve relative paths against cwd
    return resolve(cwd, inputPath);
};

const loadRegistryOrEmpty = async (registryPath: string): Promise<LoadRegistryResult> => {
    const loaded = await loadStoreRegistry(registryPath, { allowMissing: true });
    if (!loaded.ok) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: loaded.error.message,
            cause: loaded.error,
        });
    }
    return ok(loaded.value);
};

const saveRegistry = async (
    registryPath: string,
    registry: Record<string, { path: string }>
): Promise<Result<void, StoreCommandError>> => {
    const saved = await saveStoreRegistry(registryPath, registry);
    if (!saved.ok) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: saved.error.message,
            cause: saved.error,
        });
    }
    return ok(undefined);
};

const buildEmptyRootIndex = (): Result<string, StoreCommandError> => {
    const serialized = serializeIndex({ memories: [], subcategories: [] });
    if (!serialized.ok) {
        return err({
            code: 'STORE_INIT_FAILED',
            message: 'Failed to serialize root index.',
            cause: serialized.error,
        });
    }
    return ok(serialized.value);
};

const runStoreList = async (options: StoreCommandOptions): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    return ok({
        output: {
            kind: 'store-registry',
            value: formatRegistry(registryResult.value),
        },
    });
};

const runStoreAdd = async (
    options: StoreCommandOptions,
    name: string,
    path: string
): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    if (registryResult.value[name]) {
        return err({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${name}' is already registered.`,
        });
    }

    registryResult.value[name] = { path };
    const saved = await saveRegistry(options.registryPath, registryResult.value);
    if (!saved.ok) {
        return saved;
    }

    return ok({
        output: {
            kind: 'store',
            value: formatStore(name, path),
        },
    });
};

const runStoreRemove = async (options: StoreCommandOptions, name: string): Promise<StoreResult> => {
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }

    if (!registryResult.value[name]) {
        return err({
            code: 'STORE_REGISTRY_FAILED',
            message: `Store '${name}' is not registered.`,
        });
    }

    const { [name]: removed, ...rest } = registryResult.value;
    const remainingEntries = Object.keys(rest).length;
    if (remainingEntries === 0) {
        const removedRegistry = await removeStoreRegistry(options.registryPath);
        if (!removedRegistry.ok) {
            return err({
                code: 'STORE_REGISTRY_FAILED',
                message: removedRegistry.error.message,
                cause: removedRegistry.error,
            });
        }
    } else {
        const saved = await saveRegistry(options.registryPath, rest);
        if (!saved.ok) {
            return saved;
        }
    }

    const removedPath = removed?.path ?? '';
    return ok({
        output: {
            kind: 'store',
            value: formatStore(name, removedPath),
        },
    });
};

const runStoreInit = async (
    options: StoreCommandOptions,
    targetPath?: string
): Promise<StoreResult> => {
    const basePath = targetPath?.trim() || resolve(options.cwd, '.cortex');
    const rootPath = targetPath ? resolve(options.cwd, basePath) : basePath;
    const indexPath = resolve(rootPath, 'index.yaml');

    try {
        await mkdir(rootPath, { recursive: true });
        // Only create root index.yaml, no config.yaml (that's for global config dir only)
        const serializedIndex = buildEmptyRootIndex();
        if (!serializedIndex.ok) {
            return serializedIndex;
        }
        await writeFile(indexPath, serializedIndex.value, 'utf8');
    } catch (error) {
        return err({
            code: 'STORE_INIT_FAILED',
            message: `Failed to initialize store at ${rootPath}.`,
            cause: error,
        });
    }

    return ok({
        output: {
            kind: 'store-init',
            value: formatStoreInit(rootPath),
        },
    });
};

const runStoreAction = (
    options: StoreCommandOptions,
    command: string,
    args: string[]
): Promise<StoreResult> => {
    const handlers: Record<string, (args: string[]) => Promise<StoreResult>> = {
        list: () => runStoreList(options),
        add: ([name, path]) => runStoreAddCommand(options, name, path),
        remove: ([name]) => runStoreRemoveCommand(options, name),
        init: ([path]) => runStoreInit(options, path),
    };

    const handler = handlers[command];
    if (!handler) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: `Unknown store command: ${command}.`,
            })
        );
    }

    return handler(args);
};

const runStoreAddCommand = (
    options: StoreCommandOptions,
    name: string | undefined,
    path: string | undefined
): Promise<StoreResult> => {
    if (!name || !path) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store add requires a name and a path.',
            })
        );
    }
    const parsedName = validateStoreNameInput(name);
    if (!parsedName.ok) {
        return Promise.resolve(parsedName);
    }
    const parsedPath = validateStorePathInput(path);
    if (!parsedPath.ok) {
        return Promise.resolve(parsedPath);
    }
    const resolvedPath = resolveStorePath(parsedPath.value, options.cwd);
    return runStoreAdd(options, parsedName.value, resolvedPath);
};

const runStoreRemoveCommand = (
    options: StoreCommandOptions,
    name: string | undefined
): Promise<StoreResult> => {
    if (!name) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store remove requires a name.',
            })
        );
    }
    const parsedName = validateStoreNameInput(name);
    if (!parsedName.ok) {
        return Promise.resolve(parsedName);
    }
    return runStoreRemove(options, parsedName.value);
};

export const runStoreCommand = async (options: StoreCommandOptions): Promise<StoreResult> => {
    const [command, ...rest] = options.args;
    if (!command) {
        return err({
            code: 'INVALID_COMMAND',
            message: 'Store command is required.',
        });
    }
    return runStoreAction(options, command, rest);
};
