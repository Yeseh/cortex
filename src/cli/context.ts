/**
 * Store resolution utilities for CLI commands.
 *
 * This module provides functions to resolve the store context (root directory)
 * based on command-line options, current working directory, and the global
 * store registry.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { loadConfig, type CortexConfig, type ConfigLoadError } from '../core/config.ts';
import { resolveStore, type StoreResolutionError } from '../core/store/store.ts';
import {
    loadStoreRegistry,
    resolveStorePath,
    type StoreRegistry,
    type StoreRegistryLoadError,
    type StoreResolveError,
} from '../core/store/registry.ts';
import type { Result } from '../core/types.ts';

/**
 * Resolved store context containing the root path and optional store name.
 */
export interface StoreContext {
    /** The resolved filesystem path to the store root */
    root: string;
    /** The store name if resolved from registry, undefined for local/default stores */
    name?: string;
    /** The scope of the resolved store */
    scope: 'local' | 'global' | 'registry';
}

/**
 * Options for resolving store context.
 */
export interface StoreContextOptions {
    /** Current working directory (defaults to process.cwd()) */
    cwd?: string;
    /** Path to the global store (defaults to ~/.config/cortex/memory) */
    globalStorePath?: string;
    /** Path to the store registry (defaults to ~/.config/cortex/stores.yaml) */
    registryPath?: string;
}

export type StoreContextErrorCode =
    | 'CONFIG_LOAD_FAILED'
    | 'STORE_RESOLUTION_FAILED'
    | 'REGISTRY_LOAD_FAILED'
    | 'STORE_NOT_FOUND';

export interface StoreContextError {
    code: StoreContextErrorCode;
    message: string;
    cause?: ConfigLoadError | StoreResolutionError | StoreRegistryLoadError | StoreResolveError;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Default path to the global store.
 */
export const getDefaultGlobalStorePath = (): string =>
    resolve(homedir(), '.config', 'cortex', 'memory');

/**
 * Default path to the store registry.
 */
export const getDefaultRegistryPath = (): string =>
    resolve(homedir(), '.config', 'cortex', 'stores.yaml');

/**
 * Resolves store context from the registry using a named store.
 *
 * @param storeName - The name of the store to look up
 * @param registryPath - Path to the store registry file
 * @returns Result with store context or error
 */
const resolveFromRegistry = async (
    storeName: string,
    registryPath: string,
): Promise<Result<StoreContext, StoreContextError>> => {
    const registryResult = await loadStoreRegistry(registryPath, { allowMissing: false });
    if (!registryResult.ok) {
        return err({
            code: 'REGISTRY_LOAD_FAILED',
            message: `Failed to load store registry: ${registryResult.error.message}`,
            cause: registryResult.error,
        });
    }

    const pathResult = resolveStorePath(registryResult.value, storeName);
    if (!pathResult.ok) {
        return err({
            code: 'STORE_NOT_FOUND',
            message: pathResult.error.message,
            cause: pathResult.error,
        });
    }

    return ok({
        root: pathResult.value,
        name: storeName,
        scope: 'registry',
    });
};

/**
 * Resolves store context using the default resolution strategy.
 *
 * This follows the resolution order:
 * 1. Local store (.cortex/memory in cwd)
 * 2. Global store (~/.config/cortex/memory)
 *
 * @param cwd - Current working directory
 * @param globalStorePath - Path to the global store
 * @param config - Loaded configuration
 * @returns Result with store context or error
 */
const resolveDefault = async (
    cwd: string,
    globalStorePath: string,
    config: CortexConfig,
): Promise<Result<StoreContext, StoreContextError>> => {
    const storeResult = await resolveStore({
        cwd,
        globalStorePath,
        config,
    });

    if (!storeResult.ok) {
        return err({
            code: 'STORE_RESOLUTION_FAILED',
            message: storeResult.error.message,
            cause: storeResult.error,
        });
    }

    return ok({
        root: storeResult.value.root,
        scope: storeResult.value.scope,
    });
};

/**
 * Resolves the store context based on the provided options.
 *
 * Resolution strategy:
 * - If `storeName` is provided, looks up the store in the registry
 * - Otherwise, uses the default resolution (local store, then global store)
 *
 * @param storeName - Optional store name to look up in the registry
 * @param options - Resolution options (cwd, globalStorePath, registryPath)
 * @returns Result with the resolved store context or an error
 *
 * @example
 * ```ts
 * // Resolve default store
 * const result = await resolveStoreContext(undefined);
 * if (result.ok) {
 *   console.log(result.value.root); // '/path/to/.cortex/memory'
 * }
 *
 * // Resolve named store from registry
 * const result = await resolveStoreContext('work');
 * if (result.ok) {
 *   console.log(result.value.root); // '/path/to/work/store'
 *   console.log(result.value.name); // 'work'
 * }
 * ```
 */
export const resolveStoreContext = async (
    storeName: string | undefined,
    options: StoreContextOptions = {},
): Promise<Result<StoreContext, StoreContextError>> => {
    const cwd = options.cwd ?? process.cwd();
    const globalStorePath = options.globalStorePath ?? getDefaultGlobalStorePath();
    const registryPath = options.registryPath ?? getDefaultRegistryPath();

    // If a store name is provided, resolve from registry
    if (storeName) {
        return resolveFromRegistry(storeName, registryPath);
    }

    // Otherwise, load config and use default resolution
    const configResult = await loadConfig({ cwd });
    if (!configResult.ok) {
        return err({
            code: 'CONFIG_LOAD_FAILED',
            message: `Failed to load config: ${configResult.error.message}`,
            cause: configResult.error,
        });
    }

    return resolveDefault(cwd, globalStorePath, configResult.value);
};

/**
 * Loads the store registry from the default or specified path.
 *
 * @param registryPath - Optional path to the registry file
 * @returns Result with the loaded registry or error
 */
export const loadRegistry = async (
    registryPath?: string,
): Promise<Result<StoreRegistry, StoreContextError>> => {
    const path = registryPath ?? getDefaultRegistryPath();
    const result = await loadStoreRegistry(path, { allowMissing: true });

    if (!result.ok) {
        return err({
            code: 'REGISTRY_LOAD_FAILED',
            message: `Failed to load store registry: ${result.error.message}`,
            cause: result.error,
        });
    }

    return ok(result.value);
};
