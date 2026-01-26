/**
 * Store management commands for the CLI.
 */

import { mkdir, writeFile } from 'node:fs/promises';
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
import { serializeCategoryIndex } from '../../core/index/parser.ts';

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
        .map(([
            name, definition,
        ]) => ({ name, path: definition.path }))
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
    registry: Record<string, { path: string }>,
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
    const serialized = serializeCategoryIndex({ memories: [], subcategories: [] });
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
    path: string,
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
    }
    else {
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
    targetPath?: string,
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
    }
    catch (error) {
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
    args: string[],
): Promise<StoreResult> => {
    const handlers: Record<string, (args: string[]) => Promise<StoreResult>> = {
        list: () => runStoreList(options),
        add: ([
            name, path,
        ]) => runStoreAddCommand(options, name, path),
        remove: ([name]) => runStoreRemoveCommand(options, name),
        init: ([path]) => runStoreInit(options, path),
    };

    const handler = handlers[command];
    if (!handler) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: `Unknown store command: ${command}.`,
            }),
        );
    }

    return handler(args);
};

const runStoreAddCommand = (
    options: StoreCommandOptions,
    name: string | undefined,
    path: string | undefined,
): Promise<StoreResult> => {
    if (!name || !path) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store add requires a name and a path.',
            }),
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
    return runStoreAdd(options, parsedName.value, parsedPath.value);
};

const runStoreRemoveCommand = (
    options: StoreCommandOptions,
    name: string | undefined,
): Promise<StoreResult> => {
    if (!name) {
        return Promise.resolve(
            err({
                code: 'INVALID_COMMAND',
                message: 'Store remove requires a name.',
            }),
        );
    }
    const parsedName = validateStoreNameInput(name);
    if (!parsedName.ok) {
        return Promise.resolve(parsedName);
    }
    return runStoreRemove(options, parsedName.value);
};

export const runStoreCommand = async (options: StoreCommandOptions): Promise<StoreResult> => {
    const [
        command, ...rest
    ] = options.args;
    if (!command) {
        return err({
            code: 'INVALID_COMMAND',
            message: 'Store command is required.',
        });
    }
    return runStoreAction(options, command, rest);
};
