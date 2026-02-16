/**
 * Store resolution utilities for CLI commands.
 *
 * This module provides functions to resolve registry paths and build
 * a shared CortexContext for CLI handlers.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    Cortex,
    type CortexContext,
    type CortexError,
    type Result,
    err,
    ok,
} from '@yeseh/cortex-core';
import { type StoreResolveError } from '@yeseh/cortex-core/store';
import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';
import type { RegistryError, StoreNotFoundError } from '@yeseh/cortex-core/storage';

/**
 * Resolved store context containing the root path and optional store name.
 */
export type StoreContextErrorCode =
    | 'REGISTRY_LOAD_FAILED'
    | 'STORE_NOT_FOUND'
    | CortexError['code'];

export interface StoreContextError {
    code: StoreContextErrorCode;
    message: string;
    cause?: RegistryError | StoreResolveError | StoreNotFoundError | CortexError;
}
/**
 * Default path to the global store.
 *
 * @module cli/context
 * @param configDir - Optional config directory override.
 * @returns Absolute path to `~/.config/cortex/memory` or the provided configDir.
 *
 * @example
 * ```ts
 * const path = getDefaultGlobalStorePath();
 * // => /home/user/.config/cortex/memory
 *
 * const custom = getDefaultGlobalStorePath('/custom/config');
 * // => /custom/config/memory
 * ```
 */
export const getDefaultGlobalStorePath = (configDir?: string): string =>
    resolve(configDir ?? resolve(homedir(), '.config', 'cortex'), 'memory');

/**
 * Options for creating a CortexContext.
 */
export interface CreateCortexContextOptions {
    /** Config directory path (defaults to ~/.config/cortex) */
    configDir?: string;
    /** Current working directory for local store discovery */
    cwd?: string;
    /** Output stream for writing results */
    stdout?: NodeJS.WritableStream;
    /** Input stream for reading content */
    stdin?: NodeJS.ReadableStream;
    /** Current time for expiration checks and timestamps */
    now?: Date;
}

/**
 * Creates a CortexContext for CLI usage.
 *
 * This loads the Cortex configuration from the default config directory
 * and provides a context for command handlers. The context wraps a Cortex
 * instance that can resolve stores by name.
 *
 * Auto-discovers stores if config is missing:
 * - `.cortex/memory` in cwd → registered as `'local'`
 * - `~/.config/cortex/memory` → registered as `'default'`
 *
 * Edge cases:
 * - If config loading fails for any reason other than missing config, returns the error.
 * - If no stores are discovered, the registry is empty and store lookups fail.
 *
 * @module cli/context
 * @param options - Context creation options.
 * @returns Result with CortexContext or error.
 *
 * @example
 * ```typescript
 * // Create context with default config location
 * const result = await createCortexContext();
 * if (result.ok()) {
 *     const storeResult = result.value.cortex.getStore('my-store');
 *     if (storeResult.ok()) {
 *         // Use adapter...
 *     }
 * }
 *
 * // Create context with custom config directory and I/O streams
 * const custom = await createCortexContext({
 *     configDir: '/custom/config/path',
 *     cwd: '/path/to/project',
 *     stdout: process.stdout,
 *     stdin: process.stdin,
 *     now: new Date(),
 * });
 * ```
 */
export const createCortexContext = async (
    options: CreateCortexContextOptions = {}
): Promise<Result<CortexContext, StoreContextError>> => {
    const dir = options.configDir ?? resolve(homedir(), '.config', 'cortex');
    const cwd = options.cwd ?? process.cwd();

    const cortexResult = await Cortex.fromConfig(dir, createFilesystemAdapterFactory());

    // Build registry with discovered stores
    const discoveredRegistry: Record<string, { path: string }> = {};

    // Check for local store in cwd
    const localStorePath = join(cwd, '.cortex', 'memory');
    if (existsSync(localStorePath)) {
        discoveredRegistry['local'] = { path: localStorePath };
    }

    // Check for global default store
    const globalStorePath = getDefaultGlobalStorePath(dir);
    if (existsSync(globalStorePath)) {
        discoveredRegistry['default'] = { path: globalStorePath };
    }

    // If config loaded successfully, check if we need to merge discovered stores
    if (cortexResult.ok()) {
        // Check if any discovered stores are missing from config
        const missingStores = Object.keys(discoveredRegistry).filter(
            (name) => !cortexResult.value.hasStore(name)
        );

        if (missingStores.length > 0) {
            // Recreate Cortex with merged registry (discovered stores + config stores)
            const mergedRegistry = { ...discoveredRegistry, ...cortexResult.value.getStoreDefinitions() };
            const recreatedCortex = Cortex.init({
                rootDirectory: cortexResult.value.rootDirectory,
                settings: cortexResult.value.settings,
                registry: mergedRegistry,
                adapterFactory: createFilesystemAdapterFactory(),
            });

            return ok({
                cortex: recreatedCortex,
                stdout: options.stdout ?? process.stdout,
                stdin: options.stdin ?? process.stdin,
                now: options.now ?? new Date(),
            });
        }

        // Config is complete, use as-is
        return ok({
            cortex: cortexResult.value,
            stdout: options.stdout ?? process.stdout,
            stdin: options.stdin ?? process.stdin,
            now: options.now ?? new Date(),
        });
    }

    // If config load failed for a reason other than missing config, return error
    if (cortexResult.error.code !== 'CONFIG_NOT_FOUND') {
        return err({
            code: cortexResult.error.code,
            message: cortexResult.error.message,
            cause: cortexResult.error,
        });
    }

    // Config not found, create Cortex with discovered stores only
    const cortex = Cortex.init({
        rootDirectory: dir,
        registry: discoveredRegistry,
        adapterFactory: createFilesystemAdapterFactory(),
    });

    return ok({
        cortex,
        stdout: options.stdout ?? process.stdout,
        stdin: options.stdin ?? process.stdin,
        now: options.now ?? new Date(),
    });
};
