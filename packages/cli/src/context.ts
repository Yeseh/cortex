/**
 * Store resolution utilities for CLI commands.
 *
 * This module provides functions to resolve the store context (root directory)
 * based on command-line options, current working directory, and the global
 * store registry.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { loadConfig, type CortexConfig, type ConfigLoadError, type Result } from '@yeseh/cortex-core';
import {
    resolveStore,
    resolveStorePath,
    type StoreResolutionError,
    type StoreRegistry,
    type StoreResolveError,
} from '@yeseh/cortex-core/store';
import { FilesystemRegistry, FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { RegistryError, ScopedStorageAdapter, StoreNotFoundError } from '@yeseh/cortex-core/storage';

/**
 * Result of resolving a store with its adapter.
 */
export interface ResolvedStore {
    /** The resolved store context with path information */
    context: StoreContext;
    /** Scoped storage adapter for store operations */
    adapter: ScopedStorageAdapter;
}

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
    cause?: ConfigLoadError 
        | StoreResolutionError 
        | RegistryError 
        | StoreResolveError 
        | StoreNotFoundError;
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
    const registry = new FilesystemRegistry(registryPath);
    const registryResult = await registry.load();
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
    const registry = new FilesystemRegistry(path);
    const result = await registry.load();

    if (!result.ok) {
        // For allowMissing: true behavior, return empty registry if missing
        if (result.error.code === 'REGISTRY_MISSING') {
            return ok({});
        }
        return err({
            code: 'REGISTRY_LOAD_FAILED',
            message: `Failed to load store registry: ${result.error.message}`,
            cause: result.error,
        });
    }

    return ok(result.value);
};

/**
 * Resolves store context and returns a scoped storage adapter.
 *
 * Uses the Registry pattern to get a storage adapter scoped to the resolved store.
 * For named stores, uses registry.getStore(). For local/global stores, creates
 * adapter directly.
 *
 * @param storeName - Optional store name to look up in the registry
 * @param options - Resolution options
 * @returns Result with resolved store and adapter, or error
 */
export const resolveStoreAdapter = async (
    storeName: string | undefined,
    options: StoreContextOptions = {},
): Promise<Result<ResolvedStore, StoreContextError>> => {
    const registryPath = options.registryPath ?? getDefaultRegistryPath();

    // If a store name is provided, use registry.getStore() for the adapter
    if (storeName) {
        const registry = new FilesystemRegistry(registryPath);
        const registryResult = await registry.load();
        if (!registryResult.ok) {
            return err({
                code: 'REGISTRY_LOAD_FAILED',
                message: `Failed to load store registry: ${registryResult.error.message}`,
                cause: registryResult.error,
            });
        }

        const adapterResult = registry.getStore(storeName);
        if (!adapterResult.ok) {
            return err({
                code: 'STORE_NOT_FOUND',
                message: `Store '${storeName}' not found in registry`,
                cause: adapterResult.error,
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
            context: {
                root: pathResult.value,
                name: storeName,
                scope: 'registry',
            },
            adapter: adapterResult.value,
        });
    }

    // Otherwise, resolve default context and create adapter directly
    const contextResult = await resolveStoreContext(undefined, options);
    if (!contextResult.ok) {
        return contextResult;
    }

    const fsAdapter = new FilesystemStorageAdapter({
        rootDirectory: contextResult.value.root,
    });

    return ok({
        context: contextResult.value,
        adapter: {
            memories: fsAdapter.memories,
            indexes: fsAdapter.indexes,
            categories: fsAdapter.categories,
        },
    });
};
